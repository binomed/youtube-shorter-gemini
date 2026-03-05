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

### 3. Demucs (MANDATORY for Audio Separation)
The project uses **Demucs** (Meta Research) to isolate vocals from background music. This requires Python 3.

**Installation:**
```bash
# Ensure Python 3 is installed
python3 --version

# Install demucs and torchcodec (required for saving audio)
python3 -m pip install -U demucs torchcodec soundfile
```

**Verification:**
```bash
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

Pour plus de détails, voir [CONTRIBUTING.md](CONTRIBUTING.md#-running-tests) et [ADR-002](docs/adr/002-testing-strategy.md).

## 📜 Licence
Apache License 2.0
