## 1. Shared Types & DTOs

- [ ] 1.1 Add `coverImageUrl?: string` field to `ShortResponse` in `packages/shared/src/types/short.types.ts`
- [ ] 1.2 Create `UploadCoverImageDto` or use multipart — decide and document in shared types if DTO needed

## 2. Backend — Data Layer

- [ ] 2.1 Add `coverImagePath` nullable column to `Short` entity in `apps/back/src/entities/short.entity.ts`
- [ ] 2.2 Generate and apply TypeORM migration for the new column (SQLite `ALTER TABLE`)

## 3. Backend — Cover Image API Endpoints

- [ ] 3.1 Add `POST /api/projects/:projectId/shorts/:shortId/cover` endpoint — accepts JPEG upload (max 5 MB), saves to `uploads/covers/<shortId>.jpg`, updates entity
- [ ] 3.2 Add `GET /api/projects/:projectId/shorts/:shortId/cover` endpoint — streams cover image file or 404
- [ ] 3.3 Add `DELETE /api/projects/:projectId/shorts/:shortId/cover` endpoint — deletes file, nullifies column, returns 204
- [ ] 3.4 Map `coverImagePath` → `coverImageUrl` in the Short serialization (same pattern as `thumbnailUrl`)
- [ ] 3.5 Update `CleanupService` to delete cover images when a Short or Project is deleted
- [ ] 3.6 **TEST** — `analysis.controller.spec.ts`: add tests for cover upload/get/delete endpoints (mock service, verify responses 200/204/404/413)
- [ ] 3.7 **TEST** — `cleanup.service.spec.ts`: add test verifying cover image files are deleted during project cleanup (same pattern as existing thumbnail cleanup AC-3)

## 4. Backend — Export Pipeline Integration

- [ ] 4.1 Add `FFmpegService.createCoverFrameSegment(coverImagePath, outputPath, fps)` method — generates a 1-frame MP4 from a still image at the given FPS, matching 1080×1920 / libx264 / yuv420p
- [ ] 4.2 Update `ExportService.exportShort()` to check for `coverImagePath` and prepend the cover frame segment at position 0 in the concat list
- [ ] 4.3 **TEST** — `ffmpeg.service.spec.ts`: test `createCoverFrameSegment` — verify the ffmpeg command is built correctly (mock `execAsync`, assert correct flags: `-loop 1`, `-t`, scale, codec, pix_fmt)
- [ ] 4.4 **TEST** — `export.service.spec.ts`: test export WITH cover image — verify cover segment is prepended in concat list before video segments
- [ ] 4.5 **TEST** — `export.service.spec.ts`: test export WITHOUT cover image — verify export behaves identically to current (non-regression: no extra segment prepended, same subtitle timing)

## 5. Frontend — Thumbnail Editor Component

- [ ] 5.1 Create `<yts-thumbnail-editor>` Lit component in `apps/front/src/components/molecules/yts-thumbnail-editor.element.ts`
- [ ] 5.2 Implement file input (accept image/*) with drag-and-drop support
- [ ] 5.3 Implement Canvas-based crop area with locked 9:16 aspect ratio, pan (mouse drag), and zoom (scroll wheel)
- [ ] 5.4 Implement live preview of the final cropped result
- [ ] 5.5 Implement "Save" action — export canvas to 1080×1920 JPEG Blob, upload via API, emit `cover-saved` event
- [ ] 5.6 Implement "Remove" action — call DELETE API, emit `cover-removed` event
- [ ] 5.7 Implement "Cancel" action — close dialog without changes
- [ ] 5.8 Wrap in `<yts-dialog>` with proper glassmorphism styling matching the app design
- [ ] 5.9 **TEST** — `yts-thumbnail-editor.element.spec.ts` (Vitest): component renders without errors, file input triggers image load, save button emits `cover-saved` custom event with blob, cancel emits no event, remove emits `cover-removed`

## 6. Frontend — Sidebar Preview Cards

- [ ] 6.1 Change `.segment-thumb` CSS from `aspect-ratio: 16/9` to `aspect-ratio: 9/16` in `editor-page.ts`
- [ ] 6.2 Update the thumbnail image source to use `coverImageUrl ?? thumbnailUrl` priority
- [ ] 6.3 Add a hover overlay edit button (camera/pencil icon) on each segment card's thumbnail area
- [ ] 6.4 Wire the edit button click to open `<yts-thumbnail-editor>` dialog with the current Short's data
- [ ] 6.5 Handle `cover-saved` / `cover-removed` events to update the Short in project state
- [ ] 6.6 **TEST** — `editor-page.spec.ts`: add test verifying segment cards render with `aspect-ratio: 9/16` (non-regression: existing card structure and click-to-play still works)
- [ ] 6.7 **TEST** — `editor-page.spec.ts`: add test verifying image source priority — coverImageUrl used when present, thumbnailUrl used as fallback, empty placeholder when neither exists

## 7. Frontend — Service & State Integration

- [ ] 7.1 Add `uploadCoverImage(projectId, shortId, blob)` method to `project.service.ts`
- [ ] 7.2 Add `deleteCoverImage(projectId, shortId)` method to `project.service.ts`
- [ ] 7.3 Update `updateShortInProject` state action to handle `coverImageUrl` changes
- [ ] 7.4 **TEST** — `project.service.spec.ts`: test `uploadCoverImage` — mock axios POST with FormData, verify URL and response mapping
- [ ] 7.5 **TEST** — `project.service.spec.ts`: test `deleteCoverImage` — mock axios DELETE, verify URL and 204 handling
- [ ] 7.6 **TEST** — `project.state.spec.ts`: test `updateShortInProject` with `coverImageUrl` — verify state updates correctly when cover is set/removed (non-regression: existing state operations like title update still work)

## 8. Non-Regression & Integration Tests

- [ ] 8.1 **NON-REG** — `export.service.spec.ts`: verify ALL existing subtitle timing tests still pass unchanged (adjustSubtitleTimestamps)
- [ ] 8.2 **NON-REG** — `analysis.service.spec.ts`: verify existing thumbnail generation tests still pass (auto-generated thumbnails are not affected by cover feature)
- [ ] 8.3 **NON-REG** — `cleanup.service.spec.ts`: verify existing thumbnail + stems cleanup tests pass unchanged
- [ ] 8.4 **NON-REG** — `project.state.spec.ts`: verify all existing state tests pass (setProject, updateShort, setShorts, addShort, clearProject)
- [ ] 8.5 **NON-REG** — `project.service.spec.ts`: verify all existing service tests pass (getConfig, createProject, getProject, etc.)
- [ ] 8.6 **INTEGRATION** — Manual: upload cover → verify preview card shows cover in 9:16 → export Short → verify first frame is the cover image
- [ ] 8.7 **INTEGRATION** — Manual: export a Short WITHOUT cover image → verify output is identical to before the feature
- [ ] 8.8 Run `npm test --workspace=apps/back` — all backend tests green
- [ ] 8.9 Run `npm test --workspace=apps/front` — all frontend tests green
- [ ] 8.10 Run `npm run lint` and `npm run build` pass across all workspaces
