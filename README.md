# youtube-shorter-gemini

`youtube-shorter-gemini` is a productivity tool to transform long YouTube videos into vertical Shorts using Gemini AI.

## 🚀 Vision
Automate key moment detection and assembly, audio separation, and dynamic captioning locally.

## 🛠 Tech Stack
- **Monorepo:** Turborepo + npm workspaces
- **Backend:** NestJS + SQLite + FFmpeg
- **Frontend:** Lit + Lit Signals + Tailwind CSS 4.x + Shoelace
- **AI:** Gemini (Cloud/Local)

## 📁 Project Structure
- `apps/back`: Backend API (NestJS)
- `apps/front`: Web Client (Lit)
- `packages/shared`: Shared Types and DTOs
- `.agent/skills`: Custom skills for Antigravity ([see documentation](.agent/skills/README.md))
- `.agent/workflows`: BMAD Workflows for development

## 📋 Prerequisites

### 1. Node.js & npm
Ensure Node.js (v20+) and npm are installed.

### 2. FFmpeg (MANDATORY)
The project uses `ffprobe` and `ffmpeg` system binaries for video processing. **The backend application will not start without FFmpeg.**

**MacOS (Homebrew):**
```bash
brew install ffmpeg
```

**Verification:**
```bash
ffmpeg -version
ffprobe -version
```

### 3. Acoustic AI Models (Transcription & Separation)
The project uses **WhisperX** for transcription and **Demucs** for audio separation. Both require Python 3 and PyTorch.

**Installation:**
```bash
# Ensure Python 3 is installed
python3 --version

# Install all AI dependencies
# Note: Pinning torch < 2.6 is recommended to avoid new loading security changes
python3 -m pip install -U "torch<2.6" "torchaudio<2.6" demucs whisperx soundfile
```

**Verification:**
```bash
whisperx --help
demucs --help
```

---

## 🛠 Installation

```bash
# Install dependencies (at root)
npm install
```

## 🚀 Getting Started

### Development Mode (Monorepo)
To launch backend and frontend in parallel:
```bash
npm run dev
```

### Backend Only
```bash
npm run dev --workspace=back
```

### Frontend Only
```bash
npm run dev --workspace=front
```

## 🧪 Tests
```bash
# Run all tests
npm run test

# Run with coverage
npm run test:cov --workspace=back
npm run test:coverage --workspace=front
```

For more details, see [CONTRIBUTING.md](CONTRIBUTING.md#-running-tests) and [ADR-002](docs/adr/002-testing-strategy.md).

## 🐳 Docker & Deployment Profiles

This project supports two execution modes to balance between **portability** (Open Source friendly) and **precision** (Power Users).

### 1. Cloud Profile (Default & Portable)
Uses the Gemini API for transcription. It's lightweight and runs on almost any machine.
- **RAM Required**: ~1GB
- **Setup**: `docker-compose up --build`
- **Precision**: Good (phrase-level)

### 2. Local Profile (High Precision)
Uses **WhisperX** (local Python) for surgical word-level alignment and **Demucs** for stem separation.
- **RAM Required**: 8GB - 10GB
- **Setup**: Set `USE_GEMINI_SUBTITLES=false` in `docker-compose.yaml`.
- **Precision**: Surgical (word-level forced alignment)

#### 🍏 Mac (Apple Silicon / Intel)
- **Colima**: `colima start --cpu 4 --memory 10 --vm-type vz`
- **Docker Desktop**: In **Settings > Resources**, set RAM to at least 8GB (10GB recommended for WhisperX).

#### 🪟 Windows (WSL 2)
- **Prerequisite**: Ensure **WSL 2** is installed and set as the default version (`wsl --set-default-version 2`).
- **Docker Desktop**: 
    1. Go to **Settings > Resources > WSL Integration**.
    2. Enable integration with your default distro.
    3. WSL 2 will dynamically manage RAM, but if you experience OOM, create a `.wslconfig` file in your user folder:
       ```ini
       [wsl2]
       memory=10GB
       ```

#### 🐧 Linux
- Ensure the current user is in the `docker` group (`sudo usermod -aG docker $USER`).
- Linux handles memory natively, so `docker-compose up --build` should work directly if your system has 8GB+ RAM.

> [!IMPORTANT]
> Ensure `shm_size: 2gb` is set in your `docker-compose.yaml` to avoid OOM crashes with local ML engines (WhisperX/Demucs).

## 📜 Licence
Apache License 2.0
