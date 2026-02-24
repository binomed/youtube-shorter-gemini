# ADR 003: Local Audio Stem Separation Strategy

## Status
Accepted

## Context
The project requires the ability to separate audio into multiple stems (vocals vs. accompaniment) to provide high-quality audio transitions and isolation for Shorts. 

Several options were considered:
1. **Cloud APIs (AudioShake, LALAL.AI)**: Pay-per-use, requires persistent internet, and may have privacy implications.
2. **Standard FFmpeg Filters**: Fast but very low quality (mostly phase cancellation), unsuitable for professional results.
3. **Local Machine Learning Models (Demucs, Spleeter)**: High quality, zero cost per run, works offline.

## Decision
We have decided to use **Demucs** (by Meta Research) as our primary engine for audio stem separation, executed locally.

To ensure consistent performance and maximum quality, we prefer a local installation of specialized ML tools over a pure Node.js approach or low-quality filters.

## Consequences
- **Local Dependencies**: Users and developers must have `Python 3` and `demucs` installed on their host machine.
- **FFmpeg Requirement**: A working installation of `FFmpeg` is also required for audio extraction before processing.
- **Resource Usage**: Stem separation is computationally expensive. It is triggered **on-demand** and only on short segments (15-60s) to minimize processing time.
- **Installation Complexity**: The `README.md` must clearly document the prerequisites and installation steps for these external tools.
- **Improved UX**: Provides high-fidelity vocal isolation for better "Shorted" video quality without recurring API costs.
