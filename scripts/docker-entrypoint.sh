#!/bin/sh

# YouTube Shorter Gemini Docker Entrypoint

echo "Starting YouTube Shorter Gemini (Non-Root User: $(whoami))..."

# Change directory to backend
cd /app/apps/back

# Use 'exec' to replace the shell with the node process.
# This ensures that SIGTERM/SIGINT signals reach Node.js directly.
echo "Launching NestJS backend (serving frontend on root)..."
exec node dist/src/main.js
