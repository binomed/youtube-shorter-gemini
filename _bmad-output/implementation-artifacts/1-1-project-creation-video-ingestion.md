# Story 1.1: project-creation-video-ingestion

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a creator,
I want to name my project and upload a local video file (MP4/MOV),
So that I can start the creation process.

## Acceptance Criteria

1. **Given** the application home page **When** I enter a project name and select a valid video file **Then** the project is created in the database. **And** the video occupies the central workspace.
2. User can enter a project name (required, non-empty string, max 255 chars).
3. User can select and validate video file (MP4/MOV only, size limit enforced, clear error messages for invalid format/size).
4. Project is persisted to SQLite database with unique ID, name, creation timestamp, and video file path reference.
5. Video file is processed and metadata extracted (duration, resolution, codec).
6. Video player loads and displays the uploaded video in the central workspace area (vertical 9:16 format).
7. Privacy notice about data deletion policy is displayed before or during upload (FR-03 compliance).
8. System provides visual feedback during upload/processing (real-time progress via SSE).
9. Error handling: Invalid file formats and oversized files show clear, actionable error messages.
10. All interactions support keyboard navigation and WCAG 2.1 AA compliance.

## Tasks / Subtasks

- [ ] Backend: Project Entity & Database Setup (AC: 1, 6)
  - [ ] Create `Project` TypeORM entity in `apps/back/src/entities/project.entity.ts`
    - [ ] Fields: id (UUID), name (string, required), createdAt (timestamp), updatedAt (timestamp), videoPath (string)
    - [ ] Add Apache 2.0 license header
    - [ ] Use `camelCase` for properties, typeorm will map to `snake_case` in DB
  - [ ] Create database migration for projects table
  - [ ] Add validation: name must be non-empty string, max 255 characters
  
- [ ] Backend: Video Upload API (AC: 2, 3, 9)
  - [ ] Create `VideoModule` in `apps/back/src/modules/video/`
    - [ ] video.controller.ts - POST `/api/projects` endpoint
    - [ ] video.service.ts - Business logic for project creation and video upload
    - [ ] video.dto.ts (or in shared package) - Request/response DTOs
  - [ ] Implement multipart file upload handling using NestJS `@UseInterceptors(FileInterceptor())`
  - [ ] Validate file format (MP4, MOV only) using mime-type checking
  - [ ] Validate file size (recommend max 500MB for Phase 1)
  - [ ] Store video file in temporary local directory (e.g., `/tmp/youtube-shorter/uploads/{projectId}/`)
  - [ ] Return project data with file upload status
  - [ ] Implement error handling with proper HTTP exceptions (400 Bad Request for invalid format/size)
  - [ ] Add JSDoc documentation for all public methods
  - [ ] Write unit tests for VideoService (validate format, size checks)
  - [ ] Write integration test for POST `/api/projects` endpoint
  - [ ] **Import VideoModule into `apps/back/src/app.module.ts` imports array**
  
- [ ] Backend: Video Metadata Extraction (AC: 5)
  - [ ] Create `FFmpegService` in `apps/back/src/workers/ffmpeg.service.ts`
    - [ ] Implement `extractMetadata(videoPath: string)` using @ffmpeg/ffmpeg (wasm)
    - [ ] Parse video metadata for duration, resolution, codec
    - [ ] Return metadata synchronously (metadata extraction is fast, <1s)
    - [ ] Note: Using ffmpeg.wasm for zero-config setup (no system FFmpeg needed)
    - [ ] Note: Future performance improvements to be considered in later epic
  - [ ] Store metadata in Project entity (extend entity with duration, resolution fields)
  - [ ] Handle errors gracefully
  - [ ] Write unit tests for FFmpegService
  
- [ ] Backend: Real-Time Progress via SSE (AC: 8)
  - [ ] Create SSE endpoint: GET `/api/projects/:id/progress` in video.controller.ts
  - [ ] Implement Server-Sent Events stream using NestJS @Sse() decorator
  - [ ] Emit progress events during file upload and metadata extraction
  - [ ] Event format: `{ type: 'upload_progress' | 'metadata_extraction', progress: number, status: string }`
  - [ ] Close SSE connection when processing complete
  - [ ] Write integration test for SSE endpoint
  
- [ ] Frontend: Project Creation UI (AC: 2, 3, 7, 8, 9, 10)
  - [ ] Create `project-creation-form` Lit component in `apps/front/src/components/organisms/`
    - [ ] Input field for project name (required validation)
    - [ ] File input for video selection with accept attribute (accept=".mp4,.mov")
    - [ ] Privacy notice text/modal (FR-03 compliance)
    - [ ] Submit button
  - [ ] Add client-side validation for project name (non-empty)
  - [ ] Add client-side file format validation before upload
  - [ ] Display upload progress indicator (using progress event from fetch/axios)
  - [ ] Display error messages for validation failures
  - [ ] Style using Tailwind CSS 4.x (minimalist design)
  - [ ] Ensure WCAG 2.1 AA compliance (keyboard navigation, labels, contrast)
  - [ ] Write Vitest unit tests for component (happy-dom environment)
  - [ ] Write accessibility tests for form (axe-core basic checks)
  
- [ ] Frontend: SSE Progress Display (AC: 8)
  - [ ] Integrate EventSource in projectService to listen to `/api/projects/:id/progress`
  - [ ] Update UI with real-time progress (progress bar component)
  - [ ] Handle SSE connection errors and reconnection
  - [ ] Close EventSource when upload/processing completes
  - [ ] Add visual indicators: uploading spinner, metadata extraction status
  
- [ ] Frontend: Video Player Integration (AC: 6, 10)
  - [ ] Create `video-player` Lit component in `apps/front/src/components/organisms/`
    - [ ] Use HTML5 `<video>` element with vertical 9:16 aspect ratio
    - [ ] Implement controls (play/pause, seek bar, volume)
    - [ ] Support for keyboard shortcuts (Space = play/pause, J/K/L as per UX design)
    - [ ] Center video in workspace area
  - [ ] Implement video loading from backend URL
  - [ ] Add loading state while video buffers
  - [ ] Handle video playback errors (corrupt file, unsupported codec)
  - [ ] Write Vitest unit tests for player component
  - [ ] Ensure keyboard shortcuts are accessible (WCAG 2.1 AA)
  
- [ ] Frontend: API Client Service (AC: 1, 4, 8)
  - [ ] Create `projectService` in `apps/front/src/services/project.service.ts`
    - [ ] Method: `createProject(name: string, videoFile: File): Promise<Project>`
    - [ ] Use Fetch API with FormData for multipart upload
    - [ ] Handle API errors and map to user-friendly messages
    - [ ] Return typed response using DTOs from shared package
  - [ ] Add progress tracking for file upload
  - [ ] Write unit tests for projectService
  
- [ ] Shared: DTOs & Types (AC: 1, 4)
  - [ ] Create `CreateProjectDto` in `packages/shared/dto/create-project.dto.ts`
    - [ ] Fields: name (string), videoFile (metadata)
  - [ ] Create `ProjectResponseDto` in `packages/shared/dto/project-response.dto.ts`
    - [ ] Fields: id, name, createdAt, videoPath, metadata (duration, resolution)
  - [ ] Create `Project` interface/type in `packages/shared/types/project.types.ts`
  - [ ] Add class-validator decorators to DTOs
  - [ ] Write unit tests for DTO validation
  
- [ ] Integration & Testing (AC: all)
  - [ ] End-to-end flow test: Create project → Upload video → Video displays
  - [ ] Test error scenarios: Invalid format, file too large, network error
  - [ ] Verify SQLite database contains project record after creation
  - [ ] Verify video file exists in temporary storage after upload
  - [ ] Test keyboard navigation in form and player (WCAG compliance)
  - [ ] Run accessibility audit (npm run test:a11y --workspace=front)
  
- [ ] Backend: Temporary File Cleanup (AC: 7 - Privacy/Zero-Persistence)
  - [ ] Create cleanup service in `apps/back/src/modules/video/cleanup.service.ts`
  - [ ] Implement cleanup on project deletion (delete uploaded video + temp files)
  - [ ] Implement session-based cleanup (optional: delete files after X hours of inactivity)
  - [ ] Add lifecycle hook or cron job to purge orphaned temp files on app startup
  - [ ] Log cleanup operations for debugging
  - [ ] Write unit tests for cleanup logic
  - [ ] Document cleanup policy in code comments (align with FR-03)
  
- [ ] Documentation (AC: 7)
  - [ ] Create ADR 003: Video Upload & Storage Strategy
    - [ ] Document decision to use local temp storage
    - [ ] Document file validation approach
    - [ ] Document privacy/data deletion policy implementation (cleanup strategy)
  - [ ] Update CONTRIBUTING.md if new patterns established
  - [ ] Add JSDoc to all new services and controllers

## Dev Notes

### Story Complexity Estimate
- **Estimated Effort:** Medium (4-6 hours for experienced developer)
- **Key Complexity Factors:**
  - File upload handling with validation
  - TypeORM entity setup and migrations
  - FFmpeg integration (new dependency)
  - SSE real-time progress (if not familiar with pattern)
- **Quick Wins:** Form validation, video player component (standard HTML5)
- **Risk Areas:** FFmpeg setup on different platforms, file size handling

### Architecture Compliance

**Backend:**
- **Modules:** Create `VideoModule` in `apps/back/src/modules/video/` [Source: architecture.md#System Layout, line 66]
- **Entities:** Use TypeORM Data Mapper pattern, entities in `apps/back/src/entities/` [Source: architecture.md#Database Layer, line 133]
- **Workers:** FFmpegService goes in `apps/back/src/workers/` for background processing [Source: architecture.md#System Layout, line 68]
- **Naming:** `camelCase` for methods/variables, `PascalCase` for Classes, `kebab-case` for file names [Source: architecture.md#Naming Patterns, line 37]
- **API:** REST endpoints use kebab-case plural, e.g., `/api/projects` [Source: architecture.md#Naming Patterns, line 40]
- **Error Handling:** Use NestJS `HttpException` for all errors [Source: architecture.md#Format Patterns, line 50]
- **Documentation:** JSDoc required for all public APIs and business logic [Source: architecture.md#Process Patterns, line 53]

**Frontend:**
- **Components:** Atomic Design structure - form and player are "organisms" [Source: architecture.md#Structure Patterns, line 44, UX#Component Strategy, line 86]
- **Styling:** Tailwind CSS 4.x for layout/utilities, Shoelace for UI components [Source: architecture.md#Technical Constraints, line 115]
- **State:** Lit Signals for global state if needed [Source: architecture.md#System Layout, line 73]
- **Naming:** `camelCase` for props/methods, `kebab-case` for component files [Source: architecture.md#Naming Patterns, line 38]
- **Accessibility:** WCAG 2.1 AA - keyboard navigation, ARIA labels, color contrast [Source: architecture.md#Technical Constraints, line 118, UX#Accessibility, line 129]

**Shared:**
- **DTOs:** Use class-validator decorators for validation [Source: architecture.md#System Layout, line 80]
- **Types:** Common interfaces in `packages/shared/types/` [Source: architecture.md#Structure Patterns, line 45]

**Testing:**
- **Backend:** Jest for unit and integration tests, co-located `*.spec.ts` files [Source: ADR-002, line 17-19]
- **Frontend:** Vitest with happy-dom for unit tests, axe-core for basic a11y [Source: ADR-002, line 22-40]
- **Coverage:** Target 80% for core business logic [Source: ADR-002, line 56]

**Licensing:**
- All new files must include Apache 2.0 license header [Source: architecture.md#Process Patterns, line 55]

### Tech Stack for Story 1.1

**Backend:**
- NestJS @nestjs/platform-express for file upload handling
- TypeORM for Project entity and database operations
- SQLite for local data persistence
- FFmpeg (via ffprobe) for video metadata extraction
- Multer (NestJS default) for multipart form handling

**Frontend:**
- Lit 3.x for web components (project-creation-form, video-player)
- Tailwind CSS 4.x for styling
- Shoelace (sl-button, sl-input, sl-alert) for UI components
- Fetch API for HTTP requests
- HTML5 `<video>` element for playback

**Shared:**
- class-validator for DTO validation
- TypeScript interfaces for type safety

### FFmpeg Integration Strategy (Story 1.1 Scope)

**For Story 1.1 (Metadata Extraction Only):**
- **Synchronous approach is acceptable** - `ffprobe` metadata extraction is fast (<1 second)
- Implement direct `child_process.spawn` call in `FFmpegService.extractMetadata()`
- No JobService queue needed for this story

**Future Stories (Rendering/Long Tasks):**
- Full job queue pattern will be implemented using JobService (TypeORM + SQLite)
- SSE progress tracking for long-running FFmpeg renders
- [Source: architecture.md#Media Boundary, line 100-102, SQL-Queue pattern, line 148-156]

**Rationale:** Starting simple for Story 1.1, establishing foundation for future async patterns.

### FFmpeg Implementation Decision

**Decision:** Use `@ffmpeg/ffmpeg` (ffmpeg.wasm) instead of native FFmpeg binary

**Rationale:**
- ✅ **Zero system dependencies** - No FFmpeg installation required
- ✅ **npm-only setup** - `npm install` and it works
- ✅ **Cross-platform** - Works on macOS, Windows, Linux out-of-the-box
- ✅ **Simpler deployment** - No system configuration needed

**Trade-offs:**
- ⚠️ Slightly slower than native FFmpeg (WebAssembly vs native C)
- ⚠️ Larger package size (~30MB)
- ⚠️ Higher memory usage

> [!NOTE]
> **Future Performance Improvement Opportunity**
> 
> Story 1.1 uses `@ffmpeg/ffmpeg` (WebAssembly) for simplicity and zero-config setup. 
> 
> **Performance should be challenged in a future epic** when processing large videos or implementing rendering features. Consider:
> - Benchmarking wasm vs native FFmpeg performance
> - Implementing optional native FFmpeg fallback for power users
> - Profiling memory usage on large video files
> - Evaluating alternative approaches (GPU acceleration, cloud processing)
> 
> This is intentionally deferred to avoid premature optimization. Current implementation prioritizes developer experience and ease of deployment.

### Job Processing Strategy

**Story 1.1 Scope (Simple & Synchronous):**
- Video metadata extraction via ffprobe is **fast (<1 second)** - no queue needed
- Implement as **synchronous call** in FFmpegService
- Direct `child_process.spawn` execution, await result before responding to client

**Future Stories (Long-Running Tasks):**
- Rendering and AI analysis will use **SQLite-based JobService** pattern for async processing
- SSE (Server-Sent Events) for progress updates
- [Source: architecture.md#SQL-Queue Mechanism, line 148-156]

**Note:** Keep implementation simple for Story 1.1. Job queue infrastructure will be added when needed for CPU-intensive tasks.

### Previous Story Intelligence

From **Story 0.2 (quality-gates-testing-setup)**:
- Vitest is configured with happy-dom environment for frontend testing
- Test script `npm run test:a11y --workspace=front` runs accessibility tests
- Coverage is configured: `npm run test:cov --workspace=back`, `npm run test:coverage --workspace=front`
- @vitest/coverage-v8 is installed for frontend coverage
- CI/CD pipeline runs lint, tests, and basic a11y checks on every commit
- ADR pattern established for documenting technical decisions
- All tests include Apache 2.0 license headers and strict TypeScript typing

**Key Learnings to Apply:**
- Co-locate tests next to source files (`*.spec.ts`)
- Use JSDoc for all public APIs
- Ensure WCAG 2.1 AA compliance from start (keyboard nav, ARIA, contrast)
- Write both unit tests and integration tests for new features
- Update CONTRIBUTING.md if establishing new patterns
- Create ADR for significant technical decisions

### UX Requirements

**From UX Design Specification:**
- **Vertical Format:** Video player must display content in 9:16 aspect ratio [Source: UX#Core Interaction Mechanics, line 46]
- **Keyboard Shortcuts:** Support space (play/pause), J/K/L (navigation), I/O (mark in/out) [Source: UX#Accessibility, line 125-128]
- **Minimalist Design:** Focus on media content, zero-distraction interface [Source: UX#Executive Summary, line 16]
- **Desktop-First:** Optimize for desktop use (local processing power required) [Source: UX#Responsive Design, line 118]
- **Auto-save:** Changes saved instantly (not applicable to this story, but keep in mind for future) [Source: UX#UX Consistency, line 111]

### Functional Requirements Coverage

**From PRD:**
- **FR-01:** Importation de fichiers vidéo locaux (MP4, MOV) ✅ This story
- **FR-02:** Organisation et nommage des projets de Shorts ✅ This story (project naming)
- **FR-03:** Information utilisateur obligatoire sur la politique de suppression des données à l'import ✅ This story (privacy notice)

### Non-Functional Requirements

**From PRD:**
- **Performance:** Not directly applicable to upload, but keep in mind for future video processing (rendu < 60s)
- **Security:** Zero-persistence - files deleted after session (implement in future story, temp storage for now)
- **Accessibilité:** WCAG 2.1 AA ✅ Must implement in this story

### Project Structure Notes

**New Files to Create:**
```
apps/back/src/
  ├── entities/
  │   └── project.entity.ts          [NEW]
  ├── modules/
  │   └── video/
  │       ├── video.module.ts        [NEW]
  │       ├── video.controller.ts    [NEW]
  │       ├── video.service.ts       [NEW]
  │       ├── video.controller.spec.ts [NEW]
  │       └── video.service.spec.ts  [NEW]
  └── workers/
      ├── ffmpeg.service.ts          [NEW]
      └── ffmpeg.service.spec.ts     [NEW]

apps/front/src/
  ├── components/
  │   └── organisms/
  │       ├── project-creation-form.ts       [NEW]
  │       ├── project-creation-form.spec.ts  [NEW]
  │       ├── video-player.ts                [NEW]
  │       └── video-player.spec.ts           [NEW]
  └── services/
      ├── project.service.ts         [NEW]
      └── project.service.spec.ts    [NEW]

packages/shared/
  ├── dto/
  │   ├── create-project.dto.ts      [NEW]
  │   └── project-response.dto.ts    [NEW]
  └── types/
      └── project.types.ts           [NEW]

docs/adr/
  └── 003-video-upload-storage.md    [NEW]
```

**Existing Files to Modify:**
- `apps/back/src/app.module.ts` - Import VideoModule
- `apps/front/src/main.ts` or routing - Add project creation page/route

**Dependencies to Install:**
- Backend: `@nestjs/platform-express` (likely already installed), `fluent-ffmpeg` or direct ffprobe wrapper
- Frontend: None (using built-in Fetch API and HTML5 video)

### Git Intelligence

**Commit Strategy:**
- Backend setup: `feat(backend): add project entity and video upload API`
- Frontend form: `feat(frontend): add project creation form with file upload`
- Frontend player: `feat(frontend): add vertical video player component`
- Integration: `feat(integration): connect project creation flow end-to-end`
- Tests: `test: add unit and integration tests for project creation`
- Docs: `docs: add ADR-003 for video upload strategy`

### References

- [PRD: FR-01, FR-02, FR-03](file:///_bmad-output/planning-artifacts/prd.md#L99-L102)
- [Architecture: Module Structure](file:///_bmad-output/planning-artifacts/architecture.md#L62-L80)
- [Architecture: Naming Conventions](file:///_bmad-output/planning-artifacts/architecture.md#L36-L40)
- [Architecture: Database Layer](file:///_bmad-output/planning-artifacts/architecture.md#L133-L150)
- [UX Design: Vertical Player](file:///_bmad-output/planning-artifacts/ux-design-specification.md#L26)
- [UX Design: Keyboard Shortcuts](file:///_bmad-output/planning-artifacts/ux-design-specification.md#L124-L128)
- [ADR-002: Testing Strategy](file:///docs/adr/002-testing-strategy.md)
- [Story 0.2: Testing Setup Learnings](file:///_bmad-output/implementation-artifacts/0-2-quality-gates-testing-setup.md)

## Dev Agent Record

### Agent Model Used

_Will be filled by dev agent during implementation_

### Debug Log References

_Will be filled by dev agent during implementation_

### Completion Notes

_Will be filled by dev agent during implementation_

### File List

_Will be filled by dev agent during implementation_
