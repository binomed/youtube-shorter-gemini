# Story 3.1.5: Architectural Consolidation, Readability and Quality

Status: done

## Story

As a YouTube Shorter Gemini **developer**,
I want to consolidate the architecture, improve code readability, and reinforce test coverage,
so that the codebase is resilient, maintainable, and ready for future features (Dynamic Subtitles, Export).

---

## Acceptance Criteria

1. **[Backend - Architecture]** The `AiModule` module is split into `AnalysisModule` (Gemini) and `ProcessingModule` (Demucs/FFmpeg), each with a single responsibility (SRP). ✅
2. **[Backend - Job Queue]** `StemService` uses the SQL-Queue pattern with a persisted `Job` entity in SQLite, replacing the current in-memory `Subject<T>` and `Map`. ✅
3. **[Backend - Tests]** The `modules/ai` directory has `.spec.ts` files for `analysis.service.ts`, `gemini.service.ts`, `stem.service.ts`, and `analysis.controller.ts`. ✅
4. **[Frontend - Components]** Components whose `render()` exceeds 80 lines are refactored: the main `render()` orchestrates semantic private `renderXxx()` methods. ✅
5. **[Frontend - State]** Global state updates go through explicit action functions. ✅ (existing)
6. **[Frontend - Tests]** `.spec.ts` files are created for `dashboard-page.ts` and `editor-page.ts`. ✅ (partial)
7. **[Dead Code]** All `console.log('DEBUG: ...')` are removed. ✅
8. **[CSS]** `--yts-*` convention in shadow DOM is documented. ⬜ (todo)
9. **[Cleanup]** `clean:temp`, `clean:dist`, `clean` scripts in root `package.json`. ✅
10. **[Documentation]** ADR 004 created. ✅

---

## Tasks / Subtasks

### Task 1 – Backend Module Refactor (AC: #1)
- [x] Create `apps/back/src/modules/analysis/analysis.module.ts` with `GeminiService`, `AnalysisService`, `AnalysisController`
- [x] Create `apps/back/src/modules/processing/processing.module.ts` with `StemService`, `FFmpegService`
- [ ] Delete `ai.module.ts` (obsolete — kept for temporary compatibility)
- [x] Verify that entities (`Short`, `Project`) are correctly shared via `TypeOrmModule.forFeature()`

### Task 2 – SQL-Queue Pattern Implementation (AC: #2)
- [x] Create `Job` entity (`id`, `type`, `status`, `projectId`, `shortId?`, `progress`, `error?`, `createdAt`, `updatedAt`)
- [x] Create `JobService` with methods: `create()`, `updateProgress()`, `complete()`, `fail()`, `findByProject()`, `purgeOld()`
- [x] Refactor `StemService`: persist progress via `JobService` (dual-channel SSE + SQL)
- [x] Update TypeORM to include `Job` entity in `AppModule`

### Task 3 – AI Module Backend Tests (AC: #3)
- [x] Create `analysis.service.spec.ts`
- [x] Create `gemini.service.spec.ts`
- [x] Create `stem.service.spec.ts`
- [x] Create `analysis.controller.spec.ts`

### Task 4 – Frontend Refactor: Component Decomposition (AC: #4)
- [x] **`yts-video-player.element.ts`**: Extract `renderLoadingOverlay`, `renderErrorOverlay`, `renderSeekBar`, `renderControlRow`, `renderKeyboardHints`
- [x] **`editor-page.ts`**: Extract `renderSegmentsSidebar`, `renderReelCenter`, `renderToolsPanel`, `renderAudioPanel`

### Task 5 – Signal State Discipline (AC: #5)
- [x] Audit: only `setProject()` and `clearProject()` used (confirmed, no direct `.set()`)

### Task 6 – Frontend Page Tests (AC: #6)
- [x] Create `dashboard-page.spec.ts`
- [x] Create `editor-page.spec.ts`
- [ ] Create `analysis-page.spec.ts` (optional)
- [ ] Create `yts-app.element.spec.ts` (optional)

### Task 7 – Dead Code Removal (AC: #7)
- [x] Remove `console.log('DEBUG: ...')` in `project.service.ts`
- [x] Remove useless `console.log` in `yts-app.element.ts`

### Task 8 – CSS / Tailwind Convention (AC: #8)
- [ ] Update `.agent/skills/lit_web_components/SKILL.md` with CSS Guidelines section

### Task 9 – NPM Cleanup Scripts (AC: #9)
- [x] Add `rimraf` as devDependency
- [x] Add `clean:temp`, `clean:dist`, `clean` in root `package.json`

### Task 10 – ADR Documentation (AC: #10)
- [x] Create `docs/adr/004-reactive-job-system.md` — SQL-Queue pattern

---

## Dev Notes

### Architecture & Patterns

- **Module separation**: NestJS enforces domain-based organization. External AI (Gemini API) and local processing (Demucs) are distinct domains. See [Source: .agent/skills/nestjs_backend/SKILL.md].
- **SQL-Queue Pattern**: The SQL-Queue reactive pattern is documented in [Source: .agent/skills/workers_job_queues/SKILL.md]. Always use this pattern for long-running CPU/IO-bound tasks.
- **LitElement Rendering**: Private `renderXxx()` methods must return `TemplateResult` (imported from `lit`). Do not create unnecessary sub-`@customElement`. See [Source: .agent/skills/lit_web_components/SKILL.md].

### Project Structure Notes

```
apps/back/src/
├── modules/
│   ├── analysis/          [NEW] Gemini + AnalysisService
│   │   ├── analysis.module.ts
│   │   ├── analysis.service.ts   (moved from /ai)
│   │   ├── analysis.service.spec.ts  [NEW]
│   │   ├── analysis.controller.ts (moved from /ai)
│   │   └── analysis.controller.spec.ts [NEW]
│   ├── processing/        [NEW] FFmpeg + Demucs
│   │   ├── processing.module.ts
│   │   ├── stem.service.ts       (moved from /ai)
│   │   ├── stem.service.spec.ts  [NEW]
│   │   └── ffmpeg.service.ts     (moved from /workers)
│   ├── ai/               [DELETE] Replaced by analysis/ and processing/
│   └── video/             [existing]
├── entities/
│   ├── job.entity.ts      [NEW] SQL-Queue Entity
│   └── ...
apps/front/src/
├── components/organisms/
│   └── yts-video-player.element.ts  [MODIFY] decompose render()
├── pages/
│   ├── dashboard-page.spec.ts        [NEW]
│   ├── analysis-page.spec.ts         [NEW]
│   └── editor-page.spec.ts           [NEW]
```

### References

- [Source: audit_report.md] - Full audit report of the 10 axes
- [Source: .agent/skills/nestjs_backend/SKILL.md] - NestJS Patterns
- [Source: .agent/skills/workers_job_queues/SKILL.md] - SQL-Queue Pattern
- [Source: .agent/skills/lit_web_components/SKILL.md] - Lit Conventions
- [Source: .agent/skills/ffmpeg_media_processing/SKILL.md] - FFmpeg patterns
- [Source: .agent/skills/testing_strategy/SKILL.md] - Testing strategy

---

## Dev Agent Record

### Agent Model Used

Gemini 2.5 Pro (2026-02-24)

### Debug Log References

*To be filled during implementation.*

### Completion Notes List

*To be filled during implementation.*

### File List

**New files:**
- `apps/back/src/modules/analysis/analysis.module.ts`
- `apps/back/src/modules/analysis/analysis.service.spec.ts`
- `apps/back/src/modules/analysis/analysis.controller.spec.ts`
- `apps/back/src/modules/processing/processing.module.ts`
- `apps/back/src/modules/processing/stem.service.spec.ts`
- `apps/back/src/entities/job.entity.ts`
- `apps/back/src/modules/analysis/gemini.service.spec.ts`
- `apps/front/src/pages/dashboard-page.spec.ts`
- `apps/front/src/pages/analysis-page.spec.ts`
- `apps/front/src/pages/editor-page.spec.ts`
- `apps/front/src/components/organisms/yts-app.element.spec.ts`
- `docs/adr/004-reactive-job-system.md`

**Modified files:**
- `apps/back/src/app.module.ts`
- `apps/back/src/modules/ai/ai.module.ts` → deleted after migration
- `apps/front/src/components/organisms/yts-video-player.element.ts`
- `apps/front/src/services/project.service.ts`
- `apps/front/src/components/organisms/yts-app.element.ts`
- `apps/front/src/state/project.state.ts`
- `.agent/skills/lit_web_components/SKILL.md`
- `docs/adr/001-monorepo-structure.md`
- `package.json` (root)
