## Why

YouTube Shorts uses the first frame of a video as the default thumbnail visible in feeds and search results. Currently, our exported Shorts start directly with the first video frame, giving users no control over this critical first impression. A custom thumbnail — especially one designed for vertical 9:16 — can dramatically improve click-through rates. Additionally, the preview cards in the left sidebar still use a 16:9 (landscape) aspect ratio inherited from the source YouTube video, which is inconsistent with the final Short format.

## What Changes

- **Custom thumbnail upload per Short**: Users can upload a custom image that will be inserted as the very first frame of the exported Short. If no image is uploaded, the export behaves exactly as today (no extra frame).
- **Thumbnail crop/resize micro-editor**: A modal editor with a locked 9:16 crop area, allowing the user to pan, zoom, and resize their image within the frame to ensure it fits the vertical Short format. Includes a live preview.
- **Upload trigger on segment cards**: A small edit/upload button on each Short's card in the left sidebar allows quick access to the thumbnail editor.
- **Portrait preview cards**: All segment preview cards in the left sidebar switch from 16:9 (landscape) to 9:16 (portrait) aspect ratio. They display the custom thumbnail when available, or the auto-generated first-frame thumbnail as fallback.
- **Backend: thumbnail cover upload endpoint**: A new API endpoint to upload and persist a custom cover image per Short (separate from the auto-generated thumbnail).
- **Backend: FFmpeg concat at export**: During export, if a custom cover image exists, FFmpeg prepends it as a single static frame before the video content.

## Capabilities

### New Capabilities
- `thumbnail-cover-frame`: Upload, crop/resize, persist, and prepend a custom cover image as the first frame of an exported Short. Includes the micro-editor UI, backend upload/storage, and FFmpeg integration at export time.

### Modified Capabilities
_(No existing specs to modify — `openspec/specs/` is currently empty)_

## Impact

- **Frontend (`apps/front`)**: 
  - `editor-page.ts` — segment card rendering changes (portrait aspect ratio, upload button overlay)
  - New component: `yts-thumbnail-editor.element.ts` — modal crop/resize editor
  - `services/project.service.ts` — new API call for cover image upload
  - `types/short.types.ts` in shared — new `coverImageUrl` field
- **Backend (`apps/back`)**:
  - `entities/short.entity.ts` — new `coverImagePath` column
  - `modules/ai/analysis.controller.ts` — new upload endpoint for cover image
  - `modules/processing/export.service.ts` — FFmpeg concat logic for cover frame
  - `workers/ffmpeg.service.ts` — new method to create a single-frame video from a still image and concat
- **Shared (`packages/shared`)**: 
  - `ShortResponse` type — new `coverImageUrl?: string` field
  - Possible new DTO for cover image upload
- **Database**: Migration to add `coverImagePath` column to `short` table
