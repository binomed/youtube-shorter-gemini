## ADDED Requirements

### Requirement: Cover image upload per Short
The system SHALL allow users to upload a custom cover image for each individual Short. The cover image is optional — if not provided, no cover frame is added to the export.

#### Scenario: User uploads a cover image
- **WHEN** the user clicks the edit/upload button on a Short's segment card in the left sidebar
- **THEN** the thumbnail editor dialog opens, allowing the user to select an image file from their device

#### Scenario: User removes a cover image
- **WHEN** the user opens the thumbnail editor for a Short that already has a cover image
- **THEN** the editor SHALL display a "Remove" button that clears the cover image and reverts to the auto-generated thumbnail

#### Scenario: No cover image provided
- **WHEN** a Short has no custom cover image
- **THEN** the system SHALL use the auto-generated thumbnail (midpoint frame) for preview and SHALL NOT prepend any cover frame during export

---

### Requirement: Thumbnail crop/resize micro-editor
The system SHALL provide an in-browser editor that allows users to crop and resize their uploaded image to fit the 9:16 vertical Short format.

#### Scenario: Editor opens with image
- **WHEN** the user selects an image file in the thumbnail editor
- **THEN** the editor SHALL display the image within a canvas area with a locked 9:16 crop overlay, and SHALL allow the user to pan (drag) and zoom (scroll wheel) the image within the crop area

#### Scenario: Live preview of crop result
- **WHEN** the user adjusts the crop position or zoom level
- **THEN** the editor SHALL update the preview in real-time showing the final cropped result at 9:16

#### Scenario: Save cropped image
- **WHEN** the user clicks "Save" in the editor
- **THEN** the editor SHALL export the cropped region as a JPEG image at 1080×1920 resolution, upload it to the backend, and close the dialog

#### Scenario: Cancel editing
- **WHEN** the user clicks "Cancel" or closes the dialog
- **THEN** no changes SHALL be persisted and the previous cover image (or lack thereof) SHALL remain unchanged

---

### Requirement: Cover image backend persistence
The system SHALL persist custom cover images on the server filesystem and store the file path in the Short entity.

#### Scenario: Cover image upload endpoint
- **WHEN** the frontend sends a `POST /api/projects/:projectId/shorts/:shortId/cover` request with a JPEG image body
- **THEN** the backend SHALL save the image to `uploads/covers/<shortId>.jpg`, update the Short entity's `coverImagePath` column, and return the cover URL

#### Scenario: Cover image retrieval endpoint
- **WHEN** the frontend requests `GET /api/projects/:projectId/shorts/:shortId/cover`
- **THEN** the backend SHALL stream the cover image file if it exists, or return 404 if no cover image is set

#### Scenario: Cover image deletion
- **WHEN** the frontend sends a `DELETE /api/projects/:projectId/shorts/:shortId/cover` request
- **THEN** the backend SHALL delete the cover image file from disk, set `coverImagePath` to null, and return 204

#### Scenario: File size validation
- **WHEN** the uploaded image exceeds 5 MB
- **THEN** the backend SHALL reject the upload with a 413 (Payload Too Large) response

---

### Requirement: Cover frame prepended at export
The system SHALL prepend the custom cover image as a single static frame at the beginning of the exported Short video.

#### Scenario: Export with cover image
- **WHEN** a Short has a custom cover image AND the user triggers an export
- **THEN** FFmpeg SHALL create a 1-frame video segment from the cover image (at the project's frame rate) and concatenate it before the main video segments

#### Scenario: Export without cover image
- **WHEN** a Short has no custom cover image AND the user triggers an export
- **THEN** the export pipeline SHALL behave exactly as before — no cover frame is prepended

#### Scenario: Cover frame resolution and encoding
- **WHEN** the cover frame is generated
- **THEN** it SHALL match the main video's resolution (1080×1920), codec (libx264), and pixel format (yuv420p) to ensure seamless concatenation

---

### Requirement: Portrait preview cards in sidebar
The system SHALL display all Short preview cards in the left sidebar using a 9:16 (portrait) aspect ratio, with the cover image as priority source.

#### Scenario: Preview with cover image
- **WHEN** a Short has a custom cover image
- **THEN** the segment card thumbnail SHALL display the cover image in a 9:16 portrait frame

#### Scenario: Preview fallback to auto-thumbnail
- **WHEN** a Short has no custom cover image but has an auto-generated thumbnail
- **THEN** the segment card thumbnail SHALL display the auto-generated thumbnail in a 9:16 portrait frame (with object-fit: cover)

#### Scenario: Preview with no images
- **WHEN** a Short has neither a cover image nor an auto-generated thumbnail
- **THEN** the segment card thumbnail SHALL display a placeholder background in 9:16 format

#### Scenario: Upload button overlay
- **WHEN** the user hovers over a segment card's thumbnail area
- **THEN** a small edit/upload icon button SHALL appear as an overlay, indicating the thumbnail can be customized
