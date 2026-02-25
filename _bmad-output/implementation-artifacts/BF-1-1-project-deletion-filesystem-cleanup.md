# Story BF-1.1: Project Deletion — Complete Filesystem Cleanup

Status: review

## Story

As a user,
When I delete a project,
I want all temporary files created by the application on the filesystem to be deleted,
So that my disk is not polluted by orphaned temp files.

## Acceptance Criteria

1. **Given** a project was created by uploading a video **When** the project is deleted **Then** the Multer-copied upload file (`./uploads/<hash>`) is deleted from disk.
2. **Given** a project has associated Shorts with stems **When** the project is deleted **Then** the `./uploads/stems/<shortId>/` directories and all their contents are deleted.
3. **Given** Shorts have generated thumbnails **When** the project is deleted **Then** all thumbnail files referenced in `short.thumbnailPath` are deleted.
4. **Given** any of the above file deletions fail (e.g., file already deleted) **When** deletion is attempted **Then** the error is logged as a warning and the project DB record deletion proceeds normally (fail-safe).
5. **Given** the project's `videoPath` points to a user's original desktop file (outside `./uploads/`) **When** the project is deleted **Then** the original user file is NOT deleted.

## Tasks / Subtasks

- [x] Backend: Fix `CleanupService.deleteProject()` to also delete the Multer upload temp file
  - [x] After deleting stems/thumbnails, check if `project.videoPath` is inside the `./uploads/` directory.
  - [x] If it is inside `./uploads/`, delete the file using `fs.unlink()`.
  - [x] If it is NOT inside `./uploads/` (user's original file), do not delete it.
  - [x] Log the deletion or skip with appropriate labels.

- [x] Backend: Fix `CleanupService.cleanupStemFiles()` to use DB-stored paths as a fallback
  - [x] In `cleanupStemFiles()`, in addition to the hardcoded directory pattern, attempt to delete `short.vocalsPath` and `short.accompanimentPath` if they exist in the DB.
  - [x] This ensures that even if the path convention changes, stems are still removed correctly.

- [x] Tests: Update `cleanup.service.spec.ts` to cover the new deletion cases
  - [x] Test that `deleteProject()` calls `fs.unlink()` for a `videoPath` inside `./uploads/`.
  - [x] Test that `deleteProject()` does NOT call `fs.unlink()` on a `videoPath` outside `./uploads/`.
  - [x] Test that the cleanup is robust to file-not-found errors (fail-safe).

## Dev Notes

### Root Cause Analysis

The bug had two parts:

1. **Uploaded file not deleted**: When a user uploads a video, Multer saves a copy to `./uploads/<hash>` (configured in `video.module.ts`). The `videoPath` stored in the DB points to this file. `CleanupService.deleteProject()` never deleted this file, leaving an orphaned copy.

2. **Stem cleanup by convention only**: `cleanupStemFiles()` used the hardcoded path `process.cwd() + /uploads/stems/<shortId>`. It did not use the `vocalsPath` / `accompanimentPath` values stored in the `Short` entity's DB record. This was fragile if paths evolved.

### Files Modified

- `apps/back/src/modules/video/cleanup.service.ts` — Core fix
- `apps/back/src/modules/video/cleanup.service.spec.ts` — Tests

### Architecture Constraints

- **NEVER delete original user files**: The `videoPath` can point to a user's own file (e.g., `/Users/john/Videos/my-video.mp4`). Only delete if the path is inside `./uploads/`.
- **Fail-safe**: All `fs` calls must be wrapped in try/catch; failure to delete a file does not prevent the DB record from being deleted.
- **No new dependencies**: Only uses existing `fs/promises` module.

## Dev Agent Record

### Agent Model Used

Antigravity (Gemini 2.5 Pro)

### Completion Notes List

- **Root cause identified**: Multer copies uploaded files to `./uploads/<hash>`. `CleanupService.deleteProject()` was not deleting this copy. Additionally, stem cleanup only used hardcoded directory paths, ignoring DB-stored `vocalsPath`/`accompanimentPath`.
- **Fix**: Added `deleteUploadedVideoFile()` private method to `CleanupService` that uses `path.resolve()` and `path.sep` to safely detect if a `videoPath` is inside `./uploads/` before deleting.
- **Stem robustness**: `cleanupStemFiles()` now uses a two-pronged strategy: (1) deletes the directory by convention, (2) also deletes `vocalsPath`/`accompanimentPath` stored in DB as a belt-and-suspenders fallback.
- **Tests**: 11 new tests cover all ACs (AC-1 through AC-5), all pass.
- **Lint**: 0 errors after fix. Build passes.
- **Regressions**: None. Test suite went from 40 passing to 50 passing. Pre-existing 6 failures unchanged.

### File List

- apps/back/src/modules/video/cleanup.service.ts [MODIFIED]
- apps/back/src/modules/video/cleanup.service.spec.ts [MODIFIED]

### Change Log

- 2026-02-25: BF-1.1 — Fixed project deletion to delete Multer upload copy and improved stem cleanup robustness via DB-stored paths.
