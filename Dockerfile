# Stage 1: Prune
FROM node:20-slim AS pruner
WORKDIR /app
RUN npm install -g turbo
COPY . .
# Prune the workspace for BOTH back and front apps
RUN turbo prune back front --docker

# Stage 2: Build
FROM node:20-slim AS builder
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./
# Install dependencies strictly using 'npm ci' - now cached based on pruned lockfile
RUN npm ci

# Copy full source from pruner and build
COPY --from=pruner /app/out/full/ .
COPY turbo.json ./
RUN npm run build

# Stage 3: Runtime
FROM node:20-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-venv \
    libsndfile1 \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set up Python virtual environment for Demucs and WhisperX
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install --no-cache-dir "torch<2.6" "torchaudio<2.6" demucs whisperx soundfile

# Security: Create a non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup -m -s /sbin/nologin appuser

# Copy only necessary production artifacts from builder
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/back/dist ./apps/back/dist
COPY --from=builder /app/apps/back/package.json ./apps/back/
COPY --from=builder /app/apps/front/dist ./apps/front/dist

# Setup persistent directory structure with correct permissions
# Note: /home/appuser/.cache is where Demucs and WhisperX store their heavy models
RUN mkdir -p apps/back/data apps/back/uploads apps/back/logs \
    /home/appuser/.cache/htdemucs \
    /home/appuser/.cache/torch \
    /home/appuser/.cache/whisper \
    && chown -R appuser:appgroup /app /home/appuser/.cache

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/projects/config || exit 1

# Copy entrypoint script
COPY --chown=appuser:appgroup scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER appuser
ENTRYPOINT ["docker-entrypoint.sh"]
