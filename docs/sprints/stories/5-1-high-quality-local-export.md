# Story 5.1: High-Quality Local Export

Status: IN_REVIEW

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a creator,
I want to export my finalized Short as an MP4 file,
so that I can publish it on social media.

## Acceptance Criteria

1. **Given** a finalized Short in the editor
2. **When** I click on the "Export" button
3. **Then** a background process is initiated via the NestJS API.
4. **And** FFmpeg orchestrates the render locally, concatenating all segments associated with the Short if it is multi-segment.
6. **And** the previously saved subtitle profile/styles are burned into the video "hardcoded" (**NOT** embedded as a separate metadata track), perfectly matching the visual rendering (colors, fonts, box, positions) seen in the application UI.
7. **And** if audio stems are available for the project, I am prompted to select which audio tracks to include in the export (e.g., voice only, music only, or both).
8. **And** real-time progress of the export is streamed to the UI via SSE events, updating a progress bar.
9. **And** the final `.mp4` file is automatically downloaded to my local machine upon completion.
10. **And** all temporary processing files (concat lists, temporary encoded parts) **specific to this export task** are strictly cleaned up (Zero-Persistence policy). **Other temp files relating to the project like stems must be kept.**

## Tasks / Subtasks

- [ ] Task 1: Initialize Export UI and SSE Listeners (AC: 1, 2, 7, 8)
  - [ ] Add an "Export" button component (`yts-button`) in the Short Editor interface.
  - [ ] If stems are available (`stemsAvailable` flag), show a modal or dropdown upon clicking "Export" to select desired audio tracks (voice, music) before starting.
  - [ ] Create a `yts-progress-bar` or modal to display export progress continuously streaming from SSE.
  - [ ] Connect the button to call the backend export endpoint (`POST /api/export/:shortId`), passing along audio stem preferences if applicable.
- [ ] Task 2: Implement Backend Export Job Endpoint (AC: 3, 7, 8)
  - [ ] Create an `ExportController` and `ExportService` in `apps/back/src/modules/processing/`.
  - [ ] Ensure the export DTO accepts optional flags for which audio stems to include if they exist.
  - [ ] Register the export task with the SQLite-backed `JobService` (SQL-Queue Reactive pattern).
  - [ ] Ensure the job status changes dynamically dispatch SSE progress to frontend clients seamlessly.
- [ ] Task 3: FFmpeg Orchestration for High-Quality Export (AC: 4, 5, 6, 9, 10)
  - [ ] In the Job Processor, utilize the `FfmpegService` to gather all segments belonging to the Short.
  - [ ] If specific audio stems are requested, dynamically construct FFmpeg inputs and complex filtergraphs to mix the selected stems instead of the original video audio.
  - [ ] Generate the concat list for FFmpeg `concat` demuxer and execute extraction using non-blocking `spawn` in `ffmpeg.service.ts`.
  - [ ] Process the video: Scale to 1080:1920 (`-vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2"`).
  - [ ] Apply hardcoded subtitle burn-in. Generate a temporary `.ass` file from user-configured SQLite data (including Font, Color, Outline, Position XY) and use a filtergraph to burn it into the video frame (e.g., `subtitles=temp.ass`).
  - [ ] Extract progress percentage from `stderr` inside the FFmpeg process wrapper and dispatch it to the `JobService`.
  - [ ] Provide the stream or download link to the final generated file upon successful completion (`code === 0`).
  - [ ] Ensure `try/finally` blocks are in place to `fs.unlink` all temporary `.mp4` chunks, `.ass` subtitle files, and `concat.txt` lists **specifically created for this export only** regardless of success or failure. Do NOT clear the entire temp directory or stems.

## Dev Notes

### Architecture Compliance
🚨 **CRITICAL REQUIREMENTS:**
- **Zero-Persistence:** All processed media files must be generated in `%TEMP%` or `/tmp` and immediately deleted after delivery. The SQLite DB only tracks metadata. No permanent video storage!
- **Non-Blocking FFmpeg:** Never use `execSync`. You must fully utilize `spawn` with async stream handling from the `ffmpeg_media_processing` skill.
- **SQL-Queue Reactivity:** Job Orchestration must write an initial `PENDING` state to SQLite, fire an event or processor, and update the state/SSE reactively. Avoid polling.
- **State Management:** Use Lit Signals for local frontend reactivity containing the export progress numeric state.

### File Structure Requirements
- **Backend:** `apps/back/src/modules/processing/export.controller.ts`, `apps/back/src/modules/processing/export.service.ts`.
- **Frontend:** `apps/front/src/components/organisms/shorts-editor/shorts-editor.element.ts` (modifications), `apps/front/src/components/atoms/yts-export-progress.element.ts` (new).
- **Shared:** `packages/shared/dto/export.ts` if needed for request/response bodies.

### Library & Framework Requirements
- **NestJS:** TypeORM `v0.3.x` with SQLite. Active job events using `@nestjs/event-emitter`.
- **Lit:** `LitElement` with `@lit-labs/signals` for UI components.
- **Tailwind 4 / Shoelace:** Component wrappers styling.
- **FFmpeg:** `libx264` codec, `preset medium`, `crf 23` for performance and file size balance during high-quality vertical output renders.

### Testing Requirements
- **Jest (Backend):** Mock `FfmpegService.concatenateAndRenderVertical` to prevent real processing in unit tests. Verify that `JobService.updateProgress` is called properly.
- **Vitest (Frontend):** Test the `Export` button disabling upon click and SSE listener injection updating the progress bar signal. 

### Previous Story Intelligence
From Story 4.1 (`feat: complete Story 4.1...`):
- We recently implemented Single Segment Capture with precision nudging and Lit Signal reactivity.
- **Learning:** Ensure we grab the exact `startTime` and `endTime` floats from the latest updated `Segment` database entities because the recent precision nudges may have modified them just before export. Do not rely on stale arrays. 

### Git Intelligence
- Commits indicate heavy focus on robust state clears (`fix(front): clear or auto-select preset...`) and Inline Preset Updating. 
- **Learning:** Subtitle styles are highly dynamic now. Ensure the FFmpeg complex filter parses the exact current subtitle settings (font, color, box) directly from the persistent SQLite schema for the target Short.

### Project Context Reference
- [Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements] (FR15) - Export of the finalized Short to a local file (MP4) with hardcoded subtitles and optimized audio.
- [Source: _bmad-output/planning-artifacts/architecture.md#SQL-Queue Mechanism] - SQL-Queue Mechanism for FFmpeg operations.
- [Source: .agent/skills/ffmpeg_media_processing/SKILL.md] - Usage of `scale=1080:1920:force_original_aspect_ratio=decrease` for vertical layout exports.

## Dev Agent Record

### Agent Model Used

Antigravity-BMad-Method

### Debug Log References
- Extracted Story 5.1 from PRD and built comprehensive contextual structure.
- Injected specific FFmpeg Vertical scaling configurations sourced directly from skills repo.

### Completion Notes List
- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List
- _bmad-output/implementation-artifacts/5-1-high-quality-local-export.md
- apps/back/src/modules/processing/ffmpeg.service.ts
- apps/front/src/components/atoms/yts-progress-bar.element.ts
