---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-03-success', 'step-04-journeys', 'step-05-domain', 'step-06-innovation', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish']
inputDocuments: []
workflowType: 'prd'
classification:
  projectType: 'web_app'
  domain: 'scientific/ai'
  complexity: 'medium'
  projectContext: 'greenfield'
lastEdited: '2026-02-10'
editHistory:
  - date: '2026-02-10'
    changes: 'Clarified multi-segment composition. Refined workflow: In-Out capture, immediate jump-cut feedback, and adjustable micro-effects between segments.'
---

# Product Requirements Document - youtube-shorter-gemini

**Author:** jef
**Date:** 2026-02-06

## Executive Summary

**Vision**
`youtube-shorter-gemini` is a productivity tool that radically simplifies the creation of YouTube Shorts from long videos. The tool automates the detection and assembly of key moments (multi-segments/jump-cuts), audio separation, and dynamic subtitling, allowing creators to focus on content rather than technical editing.

**Key Differentiator**
Fusion of multimodal semantic analysis (Gemini) with local multimedia processing (segmenting/rendering) to ensure privacy, reactivity, and audio fluidity (stem separation).

**Target**
Independent content creators (Alex) looking to maximize their multi-platform presence with minimal effort.

## Success Criteria

### User Success
*   **Manual Interaction:** < 5 minutes to produce and refine 3-5 Shorts (potentially multi-segment).
*   **AI Quality:** >= 80% of suggested key moments are relevant and natively integrated into the Shorts.

### Business Success
*   **Productivity:** 80% reduction in Shorts production time compared to traditional manual editing.
*   **Engagement:** 100% of exported videos include dynamic subtitles optimized for retention.

### Technical Success
*   **Timing Precision:** Zero cuts in the middle of a word or key phrase thanks to transcription/audio realignment.
*   **Performance:** Rendering of a 60s Short in < 60s on a local machine.
*   **Audio:** Smooth transitions (fades or stems) without perceptible artifacts during cuts.

## User Journeys

### Alex - The Efficient Creator (Success Path)
Alex imports a 15-minute video. The AI analyzes the content, separates music from voice, and suggests 3 punchy segments. Alex validates, downloads, and publishes. Total time invested: minimal.

### Alex - The Perfectionist (Adjustment)
The AI detects several humor segments separated by "dead air". Alex uses the interface to assemble these non-contiguous moments into a single dynamic Short (jump-cut), fine-tunes the timestamps for each segment, and fixes a typo in the subtitles.

### Alex - The Guided Creator (Fallback Path)
If the AI fails to detect any significant segments, the tool provides an interactive "Survival Guide" with manual editing tips (e.g., tutorials for CapCut) and filming advice to facilitate future analysis.

## Product Scope & Roadmap

### Phase 1: MVP (Focus Local Machine)
*   **Ingestion:** Local file upload (MP4/MOV).
*   **AI Detection:** Semantic analysis via Gemini Cloud to identify key segments.
*   **Short Structure:** A Short can group multiple non-contiguous segments (jump-cuts).
*   **Fine Timing:** Automatic cut realignment to avoid truncated words.
*   **Local Processing:** Segmenting, concatenation, and rendering performed on the user's machine.
*   **Editing:** Manual correction of subtitles, framing, and timing.
*   **Export:** Vertical video (9:16) with burned-in subtitles.

### Phase 2: Growth (Hybrid AI & Connectivity)
*   **Hybrid LLM:** Choice between remote LLM (Gemini Cloud) or local (Chrome built-in APIs).
*   **Sources:** Direct import via YouTube URL.
*   **Styles:** Visual template library for subtitles.
### Phase 3: Expansion (Distribution & Automation)
*   **Publishing:** Direct exports to YouTube/TikTok/Instagram APIs.
*   **Visuals+:** Automatic addition of illustrative B-Rolls by AI.
*   **International:** Multilingual translation (audio/text).
## Domain-Specific & Innovation Requirements

### Privacy & Data Handling
*   **Zero-Persistence:** Immediate deletion of source and temporary files after download or session end.
*   **AI Consent:** Explicit Opt-in system before any storage of user corrections for future training.

### Innovative Patterns
*   **Audio Stem Separation:** Voice/music track isolation upfront to ensure perfect audio transitions, even during jump-cuts between segments.
*   **"Zero Timeline" Workflow:** Editing driven by text and segments rather than a complex timeline, even for multi-segment Shorts.
## Project-Type Specific Requirements (Web App SPA)

*   **Frontend:** SPA architecture based on **Lit**.
*   **Interactivity:** Real-time feedback (SSE) for analysis and rendering progress bars.
*   **Player:** Native visualization in vertical **9:16** format.
*   **Browsers:** Priority optimization for Chrome (leveraging expert APIs like Gemini Nano).

## Functional Requirements (Capability Contract)

### 1. Media & Project Management
- **FR-01:** Import of local video files (MP4, MOV).
- **FR-02:** Organization and naming of Shorts projects.
- **FR-03:** Mandatory user information on the data deletion policy upon import.
### 2. AI Analysis & Segmenting
- **FR-04:** Detection and suggestion of viral segments via multimodal analysis (Gemini). The user can manually capture segments via an **In-Out** mechanism during playback.
- **FR-05:** Precise timestamp adjustment (fine timing) based on audio and text to avoid truncated words.
- **FR-06:** Manual re-analysis of a segment or time zone upon user request.
### 3. Audio Processing & Subtitles
- **FR-07:** Voice/music track separation (Stems).
- **FR-08:** Automatic audio crossfades application.
- **FR-09:** Visualization and manual editing of transcription/subtitles.
### 4. Rendering & Guidance
- **FR-10:** Local video rendering handling multi-segment concatenation. Supports **immediate feedback** (visualizing the jump-cut as soon as core capture ends) and default transitions in **jump-cut** with a **micro-effects** mechanism adjustable per cut.
- **FR-11:** Real-time progress tracking (analysis and export).
- **FR-12:** Contextual tutorials display in case of automatic detection failure.
- **FR-13:** Consent management for AI learning.
- **FR-14:** Short composition from an unlimited number of non-contiguous sequences (In-Out capture) originating from the source video.
- **FR-15:** Manual custom Short creation instantly from the sidebar via an accessible "Add Short" button, which automatically extracts a midpoint thumbnail, replicates subtitles for the 30s duration, and loads it directly in the active player.
- **FR-16:** Instant snapping (calage) of IN and OUT bounds directly to the timeline playhead position using dedicated NLE buttons in the timeline controls group. Supports frame-precision rounding and smart crossing-bounds protection (shifting the opposite bound by exactly 1 frame if they cross).
## Non-Functional Requirements (Quality Attributes)

### Performance
- **Rendering:** 60s segment produced in < 60s (local machine).
- **UI Latency:** < 200ms for semantic interactions.
- **Analysis:** < 30s initial wait for a 10-minute source video.
### Security & Accessibility
- **Isolation:** Total isolation of temporary files between sessions.
- **Accessibility:** **WCAG 2.1 AA** standard (keyboard navigation, contrasts, screen readers).
### UX Design
- **Minimalism:** Interface focused on media content (zero-distraction).
- **Efficiency:** Use of keyboard shortcuts for high-frequency tasks.
