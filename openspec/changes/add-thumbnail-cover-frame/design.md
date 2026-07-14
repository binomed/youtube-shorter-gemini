## Context

The YouTube Shorter Gemini editor currently auto-generates thumbnails by extracting a frame at the midpoint of each Short's time range (via `FFmpegService.extractThumbnail`). These are stored as JPEG files in `uploads/thumbnails/` and served through a dedicated endpoint. The sidebar preview cards display these thumbnails in a 16:9 (landscape) aspect ratio — inherited from the source YouTube video format.

The export pipeline (`ExportService`) segments the video, applies subtitle overlays via ASS files, and concatenates segments with FFmpeg. There is currently no mechanism to prepend a cover image before the video content.

**Stack context**: Lit 3.x + Signals (frontend), NestJS + TypeORM + SQLite (backend), FFmpeg via spawned processes.

## Goals / Non-Goals

**Goals:**
- Allow users to upload a custom cover image per Short
- Provide an in-browser crop/resize editor locked to 9:16 to ensure the image fits vertical format
- Persist the cropped cover image server-side
- At export time, prepend the cover image as a single static frame (≈1 frame at target FPS) before the video content
- Switch all sidebar preview cards to 9:16 (portrait) aspect ratio, displaying the cover image when available, auto-generated thumbnail otherwise
- Maintain full backward compatibility: no cover image = export unchanged

**Non-Goals:**
- Animated thumbnails or GIF support
- AI-generated thumbnail suggestions
- Transition effects (fade, dissolve) between cover and video — simple hard cut only
- Custom duration control for the cover frame (always 1 frame)
- Batch thumbnail editing across multiple Shorts

## Decisions

### D1: Cover image storage — Separate from auto-generated thumbnails
The auto-generated `thumbnailPath` (midpoint frame) serves as a fallback for preview. The custom cover is stored in a new `coverImagePath` column. This avoids overwriting the auto-thumbnail and allows users to remove their custom cover without losing the fallback.

**Alternative considered**: Reuse `thumbnailPath` — rejected because it conflates two different concerns (auto-generated preview vs. user-provided cover) and complicates rollback.

### D2: Crop performed client-side, upload only the final cropped result
The Canvas API will be used to perform the crop/resize on the client. Only the final cropped 1080×1920 JPEG is uploaded. This minimizes server-side processing and bandwidth.

**Alternative considered**: Upload original + crop metadata, process server-side — rejected for added complexity without clear benefit (the user already sees the result in the live preview).

### D3: FFmpeg cover frame integration — `concat` demuxer
At export time, if a cover image exists:
1. Create a 1-frame video from the still image using `ffmpeg -loop 1 -i cover.jpg -t 0.033 -vf scale=1080:1920 -c:v libx264 -pix_fmt yuv420p cover_segment.mp4`
2. Use the `concat` demuxer to prepend this before the main video segments

This reuses the existing segment concatenation logic in `ExportService` with minimal changes — just inserting the cover segment at position 0 in the concat list.

**Alternative considered**: Using `-filter_complex concat` — rejected because the existing pipeline already uses the concat demuxer for multi-segment Shorts, making file-based concat the natural fit.

### D4: Micro-editor as a Lit Web Component in a Shoelace dialog
A new `<yts-thumbnail-editor>` component rendered inside a `<yts-dialog>`. Uses HTML Canvas for crop preview with touch/mouse drag for panning and wheel/pinch for zoom. Locked to 9:16 output ratio. Emits a `save` event with the cropped Blob.

### D5: Preview cards switch to 9:16 globally
The `.segment-thumb` CSS changes from `aspect-ratio: 16/9` to `aspect-ratio: 9/16`. The image source becomes: `coverImageUrl ?? thumbnailUrl ?? ''`. This is a purely visual/CSS change with no structural impact.

## Risks / Trade-offs

- **[Risk] Large image uploads** → Mitigated by client-side resize to max 1080×1920 before upload; backend rejects files > 5 MB.
- **[Risk] Canvas API cross-origin issues** → Not applicable since images are user-provided local files (FileReader + data URL), not fetched from external origins.
- **[Risk] FFmpeg concat frame rate mismatch** → Mitigated by encoding the cover segment with the same FPS as the main export (read from project metadata).
- **[Trade-off] 1-frame duration is imperceptible during playback** → This is intentional. The cover serves as YouTube's thumbnail picker, not as viewable intro content. YouTube uses the first frame as the default thumbnail.
