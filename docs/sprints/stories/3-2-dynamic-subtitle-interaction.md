# Story 3.2: dynamic-subtitle-interaction

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a creator,
I want to edit subtitles directly on the video and customize their appearance (font, size, position),
so that my Shorts have a unique and professional brand.

## Acceptance Criteria

1. **Given** a video preview with subtitles **When** I click a subtitle, the video pauses and a floating text editor appears.
2. **Given** a floating text editor **When** blur or save occurs **Then** the `Subtitle` entity is correctly updated in the database.
3. **Given** a dedicated style panel **When** I change settings **Then** I can adjust font profile, size, and XY position.
4. **Given** styling changes **When** applied **Then** they are persisted at the Short level.

## Tasks / Subtasks

- [x] Task 1: Shared Models & Types Update (AC: 2, 4)
  - [x] Update `Short` types to support `subtitleStyle`
  - [x] Define `Subtitle` interfaces
- [x] Task 2: Backend Entities & Endpoints (AC: 2, 4)
  - [x] Create/update `Subtitle` entity + add `subtitleStyle` JSON to `Short`
  - [x] Create endpoints for subtitle adjustments (`PATCH /shorts/:id/style` and subtitle text)
  - [x] Add unit tests for SRT parser logic
- [x] Task 3: Frontend Subtitle Engine (AC: 1, 2)
  - [x] Build `<yts-subtitle-overlay>` for display and timing logic
  - [x] Build `<yts-subtitle-editor>` for auto-pause and save-on-blur capabilities
- [x] Task 4: Frontend Styling Toolkit (AC: 3, 4)
  - [x] Create `<yts-subtitle-style-panel>` targeting font, size, and position
  - [x] Integrate style panel in `<yts-video-player>` and handle style persistence over API

## Dev Notes

- **Architecture Details:** We previously refactored `AnalysisModule` & `ProcessingModule` with a robust SQL-Queue pattern. `Subtitle` handling should be stateless on the client-side using **Lit Signals**, delegating persistence tracking to the Event Loop or blur events.
- **Frontend Stack:** Lit 3.x, TailwindCSS 4.x, Shoelace. Shadows styles are heavily enforced. `subtitleStyle` variables should map to CSS Custom Properties.
- **Validation Guidelines:** Avoid complex forms; stick to atomic real-time updates wherever possible for UX minimal latency.

### Project Structure Notes

- Keep the new Lit components in `apps/front/src/components/organisms/` (or `molecules/` depending on scale).
- Entity creation in `apps/back/src/entities/subtitle.entity.ts`.

### References

- [Source: Docs - epics.md#Story-3.2]
- [Source: Docs - ux-design-specification.md#CreativeSupervisor]

## Dev Agent Record

### Agent Model Used

Antigravity (Expert BMad Model)

### Debug Log References

### Completion Notes List

- AI ADVERSARIAL REVIEW: Fixed critical validation gap in Subtitle DTO parameters (missing length, regex boundaries).
- AI ADVERSARIAL REVIEW: Fixed logic flaw inside AnalysisService where Subtitles would duplicate if they overlapped consecutive shorts.
- AI ADVERSARIAL REVIEW: Synchronized story file history with the actual 17 files modified.

### File List

- [x] `packages/shared/src/types/short.types.ts`
- [x] `packages/shared/src/index.ts`
- [x] `apps/back/src/app.module.ts`
- [x] `apps/back/src/entities/subtitle.entity.ts`
- [x] `apps/back/src/entities/short.entity.ts`
- [x] `apps/back/src/modules/ai/analysis.controller.ts`
- [x] `apps/back/src/modules/ai/analysis.service.ts`
- [x] `apps/back/src/modules/ai/dto/update-subtitle.dto.ts`
- [x] `apps/back/src/modules/ai/utils/srt-parser.util.ts`
- [x] `apps/back/src/modules/ai/utils/srt-parser.util.spec.ts`
- [x] `apps/back/src/modules/analysis/analysis.module.ts`
- [x] `apps/front/src/components/short-player.ts`
- [x] `apps/front/src/components/organisms/yts-video-player.element.ts`
- [x] `apps/front/src/components/molecules/yts-subtitle-overlay.element.ts`
- [x] `apps/front/src/components/molecules/yts-subtitle-editor.element.ts`
- [x] `apps/front/src/components/molecules/yts-subtitle-style-panel.element.ts`
- [x] `apps/front/src/pages/editor-page.ts`
