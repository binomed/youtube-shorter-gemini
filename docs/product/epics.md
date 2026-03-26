---
stepsCompleted: [1, 2, 3]
inputDocuments: ['_bmad-output/planning-artifacts/prd.md', '_bmad-output/planning-artifacts/architecture.md', '_bmad-output/planning-artifacts/ux-design-specification.md']
---

# youtube-shorter-gemini - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for youtube-shorter-gemini, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: Import of local video files (MP4, MOV).
FR2: Organization and naming of Short projects.
FR3: Mandatory user information on the data deletion policy upon import.
FR4: Detection and suggestion of viral segments via multimodal analysis (Gemini). The user can manually capture segments via an In-Out mechanism during playback.
FR5: Precise timestamp adjustment (fine timing) based on audio and text to avoid truncated words.
FR6: Manual re-analysis of a segment or time zone upon user request.
FR7: Voice/music track separation (Stems).
FR8: Automatic audio crossfades application.
FR9: Visualization and manual editing of transcription/subtitles.
FR10: Local video rendering handling multi-segment concatenation. Supports immediate feedback (visualizing the jump-cut as soon as the capture ends) and default jump-cut transitions with a mechanism for adjustable micro-effects per cut.
FR11: Real-time progress tracking (analysis and export).
FR12: Contextual tutorial display in case of automatic detection failure.
FR13: Consent management for AI learning.
FR14: Short composition from an unlimited number of non-contiguous sequences (In-Out capture) originating from the source video.
FR15: Export of the finalized Short to a local file (MP4) with burned-in subtitles and optimized audio.

### NonFunctional Requirements

NFR1: Rendering of a 60s segment produced in < 60s (local machine).
NFR2: UI Latency < 200ms for semantic interactions.
NFR3: Analysis < 30s initial wait for a 10-minute source video.
NFR4: Total isolation of temporary files between sessions.
NFR5: WCAG 2.1 AA Standard (keyboard navigation, contrasts, screen readers).
NFR6: Minimalism: Interface focused on media content (zero-distraction).
NFR7: Efficiency: Use of keyboard shortcuts for high-frequency tasks.

### Additional Requirements

- **Starter Template:** Turborepo + npm workspaces (Architecture).
- **Backend:** NestJS (Node.js) with SQLite/TypeORM (Architecture).
- **Frontend:** LitElement + Lit Signals with Atomic Design. Styled with **Tailwind CSS 4.x** (Layout/Utilities) and **Shoelace** (UI Components) (Architecture).
- **Media Processing:** FFmpeg via child_process.spawn with JobService orchestration (Architecture).
- **Communication:** REST API + SSE for real-time progress (Architecture).
- **Navigation:** Vertical Reel scroller (UX).
- **Interaction Model:** "Creative Supervisor" (IA proposal, User validation/exception) (UX).
- **Editing:** Direct floating text editing on video (UX).
- **Multi-segment Workflow:** "Capture & Adjustment" (Mark In/Out) (UX).
- **Shortcuts:** Space, J, K, L, I, O, Backspace (UX).
- **Accessibility:** WCAG 2.1 AA compliance (UX).
- **Feedback:** Instant auto-save for all adjustments (UX).

### FR Coverage Map

FR1: Epic 1 - Projects
FR2: Epic 1 - Projects
FR3: Epic 1 - Projects
FR4: Epic 2 - Gemini Discovery
FR5: Epic 3 - Enrichment
FR6: Epic 2 - Gemini Discovery
FR7: Epic 3 - Enrichment
FR8: Epic 3 - Enrichment
FR9: Epic 3 - Enrichment
FR10: Epic 4 - Editor
FR11: Epic 4 - Editor
FR12: Epic 1 & 2 - Support
FR13: Epic 1 - Privacy
FR14: Epic 4 - Editor
FR15: Epic 5 - Export
FR16: Epic 7 - Advanced Layout (New)

### Epic 1: Workspace & Technical Induction
Establish the project foundation and enable video ingestion.
**Goal:** Functional monorepo with project management and privacy-compliant media induction.
**FRs covered:** FR1, FR2, FR3, FR13

### Epic 2: Gemini-Powered Magic Moments
Automate viral potential discovery using AI and provide guidance.
**Goal:** Gemini-driven segment suggestions and user fallback/tutorial support.
**FRs covered:** FR4, FR6, FR12

### Epic 3: Advanced Media Enrichment (Audio & Subtitles)
Elevate technical quality with stems and customizable dynamic subtitles.
**Goal:** Clean transcription, voice isolation, and stylized interactive text overlays.
**FRs covered:** FR5, FR7, FR8, FR9

### Epic 4: Multi-Segment Editor & Real-time Render
Provide a reactive video editing experience.
**Goal:** Multi-segment assembly with immediate jump-cut feedback.
**FRs covered:** FR10, FR11, FR14

### Epic 5: Final Production & Export
Convert work into an exploitable video file.
**Goal:** High-quality MP4 file export ready for publication.
**FRs covered:** FR15

---

## Epic 1: Workspace & Technical Induction

### Story 1.1: Project Scaffolding & CI Setup
As a Developer,
I want to initialize the Turborepo (NestJS/Lit) with quality gates and Playwright accessibility tests,
So that I have a solid, accessible foundation for development.

**Acceptance Criteria:**
- **Given** a new project directory
- **When** the bootstrap script is run
- **Then** a monorepo is created with `apps/back`, `apps/front`, and `packages/shared`.
- **And** CI runs automated unit tests and Axe-core accessibility audits (Playwright).

### Story 1.2: Project Creation & Video Ingestion
As a creator,
I want to name my project and upload a local video file (MP4/MOV),
So that I can start the creation process.

**Acceptance Criteria:**
- **Given** the application dashboard
- **When** I enter a project name and select a valid video file
- **Then** a project is created and the video is ingested into the workspace.

### Story 1.3: Privacy Awareness & Consent
As a privacy-conscious user,
I want to be informed about the data deletion policy and give my consent for AI learning,
So that I feel secure about my files.

**Acceptance Criteria:**
- **Given** the ingestion process
- **When** I upload a video
- **Then** a mandatory notice about file deletion is displayed.
- **And** an explicit opt-in for AI learning is presented.

---

## Epic 2: Gemini-Powered Magic Moments

### Story 2.1: Automated Viral Analysis
As a creator,
I want the IA to analyze my video and suggest 3-5 segments with high potential,
So that I don't waste time searching for key moments.

**Acceptance Criteria:**
- **Given** an uploaded video
- **When** I trigger the IA analysis
- **Then** Gemini returns a list of suggested segments with titles and timestamps.
- **And** these segments appear as thumbnails in the sidebar.

### Story 2.2: Survival Guide (Fallback UI)
As a creator,
I want to receive advice if the IA fails to detect any viral segments,
So that I am not left without a solution.

**Acceptance Criteria:**
- **Given** an analysis return with 0 segments
- **When** the user is on the results page
- **Then** a "Survival Guide" is displayed with tips for manual editing and filming advice.

---

## Epic 3: Advanced Media Enrichment (Audio & Subtitles)

### Story 3.1: Audio Stem Separation & Transitions
As a producer,
I want to isolate voice from background music and apply automatic crossfades,
So that transitions sounding professional and fluid.

**Acceptance Criteria:**
- **Given** an analysis process
- **When** the system generates stems
- **Then** separate tracks are available in the editor.
- **And** progress bars show the status of separation for each stem.
- **And** crossfades are automatically generated between jump-cuts.

### Story 3.2: Dynamic Subtitle Editor & Styling
As a creator,
I want to edit subtitles directly on the video and customize their appearance (font, size, position),
So that my Shorts have a unique and professional brand.

**Acceptance Criteria:**
- **Given** a video preview with subtitles
- **When** I click a subtitle, the video pauses and a floating text editor appears.
- **And** the `Subtitle` entity is correctly updated in the database on blur/save.
- **And** I can adjust font profile, size, and XY position via a dedicated style panel.
- **And** styling changes are persisted at the Short level.

**Future Scope / Backlog:**
- Advanced text styling options (Outline, Text Shadow, Background Padding variations).
- "Highlight Words" functionality to automatically or manually emphasize specific words within the subtitles.

---

## Epic 4: Multi-Segment Editor & Real-time Render

### Story 4.1: Manual Segment Capture (In/Out)
As a creator,
I want to capture my own segments using hotkeys (I/O) during playback,
So that I have full control over the narrative flow.

**Acceptance Criteria:**
- **Given** a playing video
- **When** I press 'I' then 'O'
- **Then** a new segment is added to the selection.
- **And** the segment is immediately visible in the multi-timeline.

### Story 4.2: Real-time Jump-Cut Preview
As a creator,
I want to see the sequence of my segments with jump-cuts immediately,
So that I can verify the edit without waiting for a full render.

**Acceptance Criteria:**
- **Given** multiple segments in a Short
- **When** the player reaches the end of a segment
- **Then** it jumps immediately to the start of the next one.
- **And** SSE events provide real-time feedback on background processing stages.

---

## Epic 5: Final Production & Export

### Story 5.1: High-Quality Local Export
As a creator,
I want to export my finalized Short as an MP4 file,
So that I can publish it on social media.

**Acceptance Criteria:**
**Given** a finalized Short
**When** I click on "Export"
**Then** FFmpeg processes the render locally.
**And** a 9:16 vertical MP4 file with burned-in subtitles is saved to my machine.

---

## Epic 6: App Configuration Settings

### Story 6.1: Global Settings Interface
As a power user,
I want to be able to configure AI and video processing parameters (e.g. Gemini model choice, frame extraction interval),
So that I can fine-tune the performance and quality of the analysis to my specific needs.

**Acceptance Criteria:**
**Given** the application home page or navigation menu
**When** I navigate to the "Settings" or "Configuration" section
**Then** I see options to modify key parameters (e.g., "Frame Extraction Interval (seconds)", "Gemini Model").
**And** changes I make are saved persistently and applied to all future video analyses.

---

## Epic 7: Advanced Video Layout & Framing

### Story 7.1: Gemini Layout & Centering Detection
As a creator,
I want the AI to accurately detect the subject's X-position AND identify scenes that span the full width (landscape aspect),
So that my vertical shorts are well-framed natively or properly presented in a fullscreen multi-layer view.

**Acceptance Criteria:**
- Gemini returns `layoutTimeline` (sequence of `layoutMode` and `centerX`) per segment to handle movement and scene changes within one clip.
- Values are persisted in the `segments` JSON of the `Short` entity.

### Story 7.2: Interactive Player Reframing (Frontend)
As a creator,
I want to manually adjust the X-position of the video within the 9:16 frame and toggle between Fill and Fullscreen modes,
So that I compose the visual exactly as I want.

**Acceptance Criteria:**
- Sliders for `centerX` and toggle for `layoutMode` appear in the editor.
- Video preview updates in real-time (pan effect or blurred background).
- Changes are saved to the active segment.

### Story 7.3: FFmpeg Layout Engine update (Backend)
As a creator,
I want my exported video to perfectly match the framing and layout mode chosen in the editor,
So that my final render is ready for social media.

**Acceptance Criteria:**
- FFmpeg applies specific filters per segment.
- "Fill" mode uses dynamic crop based on `centerX`.
- "Fullscreen" mode uses blurred background + scaled foreground.
- Final MP4 reflects all layout choices.
