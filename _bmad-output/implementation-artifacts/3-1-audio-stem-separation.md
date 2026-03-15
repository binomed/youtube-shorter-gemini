# Story 3.1: audio-stem-separation

Status: review

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a producer,
I want the system to isolate voice from background music,
So that transitions and cuts don't sound abrupt.

## Acceptance Criteria

1. **Given** a selected segment **When** processing starts **Then** separate audio stems (voice/music) are generated.
2. The processing runs asynchronously via the SQL-Queue mechanism.
3. Real-time progress is streamed to the client via SSE.

## Tasks / Subtasks

- [x] Backend: Audio Stem Separation
  - [x] Implement stem separation using a local ML CLI tool (e.g., `spleeter` or `demucs`). This operation is triggered **ON-DEMAND per Short** (not on the entire source video) to save processing time and avoid unnecessary complexity.
  - [x] Extend `FFmpegService` or create a new `AudioService` (e.g., `SpleeterService`) to orchestrate the CLI call separating the track into 2 stems (Voice vs. Accompaniment).
  - [x] Register a new Job type in the SQL-Queue for "Stem Separation".
  - [x] Emit SSE progress events during processing.

- [x] Backend: Project Deletion Cleanup
  - [x] Ensure that when a project is deleted, any generated `.wav` or `.mp3` stem files in the project's temporary media folder are successfully deleted alongside the original video.

- [x] Frontend: Stem Separation UI
  - [x] Add a trigger or background process hook in `editor-page.ts` / `analysis-page.ts` to show Stem Separation progress.
  - [x] Integrate with the existing global Lit Signal state management (`projectSignal`).
  - [x] Provide a basic UI configuration (in the "Audio" tab of the right sidebar) to adjust Voice/Music mix if necessary.

## Dev Notes

### Technical Requirements
- **Local Stem Separation Strategy**: FFmpeg itself cannot isolate vocals from a mixed track. This requires a Deep Learning tool. We will use `spleeter` (by Deezer) or `demucs` as a CLI binary executed via `child_process.spawn`. The user must install Python and the tool globally (`pip install spleeter`), or we provide instructions. The process is computationally heavy, which is why it MUST be executed **PER SHORT** (on small 15-60s excerpts) rather than the entire 1-hour source video.
- **Media Boundary**: All CLI tools must be invoked using `child_process.spawn` non-blockingly. Do not block the NestJS event loop.
- **SQL-Queue**: Long-running audio processing MUST use the Event-driven SQL-Queue pattern defined in the architecture (Status: PENDING -> PROCESSING -> DONE).
- **Storage**: Generated stems should be saved as temporary `.wav` files within the project's local media folder (`uploads/:projectId`). Avoid saving binary blobs in SQLite, and **always clean them up on project deletion.**

### Architecture Compliance
- Keep REST API format (`{ success: boolean, data: T }`) for triggering.
- SSE MUST be used for progress tracking, consistent with Epic 2's implementation.
- Frontend must use Atomic Design standards with CSS pure / Tailwind utilities, and Lit Signals for state management. Avoid deeply nested non-reactive states.

### Previous Story Intelligence
- In story `2-1-automated-viral-analysis`, we refined the SSE event formatting (`AnalysisProgressEvent`). Use a similar robust error-catching and retry mechanism for audio processing. 
- Types are centralized in `@youtube-shorter/shared`. Add any new UI DTOs or Event types there.

### Project Structure Notes

- Keep logic isolated: Controller handles HTTP -> Service handles DB and orchestration -> Worker runs FFmpeg/Processing.

### References

- [Source: epics.md#Story 3.1: Audio Stem Separation]
- [Source: architecture.md#SQL-Queue Mechanism (Reactive)]
- [Source: architecture.md#Media Boundary (FFmpeg)]

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini Advanced Agentic Coding)

### Completion Notes List

- Ultimate context engine analysis completed - comprehensive developer guide created. Includes architectural guardrails for SQL-Queue and SSE.
- **Backend: StemService** — Created `apps/back/src/modules/ai/stem.service.ts` wrapping `demucs` CLI (Facebook Research). Extracts audio segment per-Short via FFmpeg, runs 2-stem separation, locates output files, and saves paths to DB.
- **Backend: Short entity** — Added `vocalsPath` and `accompanimentPath` columns to `short.entity.ts`.
- **Backend: AnalysisController** — Added 3 stem endpoints: POST trigger, SSE progress, GET audio stream.
- **Backend: AiModule** — Registered `StemService` as provider and export.
- **Backend: CleanupService** — Added `cleanupStemFiles()` that deletes `uploads/stems/<shortId>/` directories and thumbnails on project deletion.
- **Shared: StemProgressEvent** — Added SSE event type to `@youtube-shorter/shared`.
- **Frontend: Audio tab** — Added "Audio" tab to editor-page sidebar with stem separation trigger button, SSE progress bar, and audio playback controls for vocals/accompaniment.
- **Compilation** — Backend and frontend both compile with 0 TypeScript errors.

### File List

- apps/back/src/modules/ai/stem.service.ts [NEW]
- apps/back/src/modules/ai/ai.module.ts [MODIFIED]
- apps/back/src/modules/ai/analysis.controller.ts [MODIFIED]
- apps/back/src/modules/video/cleanup.service.ts [MODIFIED]
- apps/back/src/entities/short.entity.ts [MODIFIED]
- packages/shared/src/types/short.types.ts [MODIFIED]
- packages/shared/src/index.ts [MODIFIED]
- apps/front/src/pages/editor-page.ts [MODIFIED]
