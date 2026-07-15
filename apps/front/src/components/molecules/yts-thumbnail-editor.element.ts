import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import { ytsPremiumStyles } from '../../styles/yts-styles.ts';
import '../molecules/yts-dialog.element.ts';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import type { YtsDialog } from '../molecules/yts-dialog.element.ts';

/**
 * Thumbnail editor component for YouTube Shorter.
 * Provides a crop/resize micro-editor locked to 9:16 aspect ratio.
 *
 * Features:
 * - File input with drag-and-drop
 * - Canvas-based crop area with locked 9:16 aspect ratio
 * - Pan (mouse drag) and zoom (scroll wheel)
 * - Live preview of the cropped result
 * - Save → exports to 1080×1920 JPEG, emits `cover-saved` with blob
 * - Remove → emits `cover-removed`
 * - Cancel → closes without changes
 *
 * @fires cover-saved - Dispatched with { blob: Blob } when the user saves
 * @fires cover-removed - Dispatched when the user removes the cover image
 */
@customElement('yts-thumbnail-editor')
export class YtsThumbnailEditor extends LitElement {
  /** Project ID for API calls */
  @property({ type: String }) projectId = '';

  /** Short ID for API calls */
  @property({ type: String }) shortId = '';

  /** Whether this short currently has a cover image */
  @property({ type: Boolean }) hasCover = false;

  @state() private imageLoaded = false;
  @state() private saving = false;
  @state() private dragOver = false;

  @query('yts-dialog') private dialog!: YtsDialog;
  @query('#crop-canvas') private cropCanvas!: HTMLCanvasElement;
  @query('#preview-canvas') private previewCanvas!: HTMLCanvasElement;
  @query('#file-input') private fileInput!: HTMLInputElement;

  // Image state
  private image: HTMLImageElement | null = null;
  private panX = 0;
  private panY = 0;
  private zoomLevel = 1;

  // Drag state
  private dragging = false;
  private lastMouseX = 0;
  private lastMouseY = 0;

  // Canvas dimensions (display size - proportional 9:16 fitting neatly within max-height popup)
  private readonly CROP_WIDTH = 225;
  private readonly CROP_HEIGHT = 400; // 9:16 ratio
  private readonly PREVIEW_WIDTH = 117;
  private readonly PREVIEW_HEIGHT = 208;

  // Output dimensions
  private readonly OUTPUT_WIDTH = 1080;
  private readonly OUTPUT_HEIGHT = 1920;

  static styles = [
    ytsPremiumStyles,
    css`
      :host {
        display: contents;
        --yts-dialog-max-width: 540px;
      }

      .canvas-wrapper {
        position: relative;
        display: inline-flex;
        border-radius: 8px;
        overflow: hidden;
        border: 2px solid rgba(99, 102, 241, 0.5);
      }

      .zoom-controls {
        position: absolute;
        bottom: 12px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 6px;
        align-items: center;
        justify-content: center;
        background: rgba(15, 15, 26, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 20px;
        padding: 4px 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
        z-index: 5;
      }

      .zoom-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: white;
        border-radius: 6px;
        padding: 4px 10px;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s ease;
      }

      .zoom-btn:hover {
        background: rgba(99, 102, 241, 0.3);
        border-color: rgba(99, 102, 241, 0.6);
      }

      .editor-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        align-items: center;
        width: 100%;
      }

      .canvases-row {
        display: flex;
        gap: 24px;
        align-items: flex-start;
        justify-content: center;
      }

      .canvas-section {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }

      .canvas-label {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: rgba(255, 255, 255, 0.5);
      }

      #crop-canvas {
        border: none;
        border-radius: 0;
        cursor: grab;
        background: #0f0f1a;
        display: block;
        width: 225px;
        height: 400px;
      }

      #crop-canvas:active {
        cursor: grabbing;
      }

      #preview-canvas {
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 6px;
        background: #0f0f1a;
        display: block;
        width: 117px;
        height: 208px;
      }

      .drop-zone {
        width: 100%;
        min-height: 180px;
        border: 2px dashed rgba(99, 102, 241, 0.4);
        border-radius: 12px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        background: rgba(99, 102, 241, 0.05);
        padding: 24px;
      }

      .drop-zone:hover,
      .drop-zone.drag-over {
        border-color: rgba(99, 102, 241, 0.8);
        background: rgba(99, 102, 241, 0.1);
      }

      .drop-zone sl-icon {
        font-size: 2rem;
        color: rgba(99, 102, 241, 0.6);
      }

      .drop-text {
        color: rgba(255, 255, 255, 0.6);
        font-size: 14px;
      }

      .drop-hint {
        color: rgba(255, 255, 255, 0.3);
        font-size: 12px;
      }

      .zoom-hint {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.35);
        text-align: center;
      }

      input[type="file"] {
        display: none;
      }

      .footer-actions {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        width: 100%;
        flex: 1;
      }

      .footer-actions .cancel-btn {
        margin-right: auto;
      }

      sl-button::part(base) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
      }

      sl-button::part(prefix) {
        display: inline-flex;
        align-items: center;
        justify-content: center;
      }

      sl-button sl-icon {
        display: inline-flex;
        align-items: center;
        vertical-align: middle;
      }
    `,
  ];

  render() {
    return html`
      <yts-dialog
        hoist
        label="Thumbnail Editor"
        .hoist=${true}
        style="--yts-dialog-max-width: 540px; --sl-z-index-dialog: 99999; z-index: 99999;"
      >
        <div class="editor-container">
          ${this.imageLoaded
            ? this.renderEditor()
            : this.renderDropZone()
          }
        </div>

        <div slot="footer" class="footer-actions">
          <sl-button variant="default" size="medium" @click=${this.handleCancel} class="cancel-btn">
            Cancel
          </sl-button>
          ${this.imageLoaded
            ? html`
              ${this.hasCover ? html`
                <sl-button
                  variant="danger"
                  size="medium"
                  @click=${this.handleRemove}
                  ?disabled=${this.saving}
                >
                  <sl-icon slot="prefix" name="trash"></sl-icon>
                  Remove
                </sl-button>
              ` : nothing}
              <sl-button
                variant="primary"
                size="medium"
                @click=${this.handleSave}
                ?loading=${this.saving}
                ?disabled=${this.saving}
              >
                <sl-icon slot="prefix" name="check"></sl-icon>
                Save Cover
              </sl-button>
            `
            : html`
              ${this.hasCover ? html`
                <sl-button variant="danger" size="medium" @click=${this.handleRemove}>
                  <sl-icon slot="prefix" name="trash"></sl-icon>
                  Remove Cover
                </sl-button>
              ` : nothing}
            `
          }
        </div>
      </yts-dialog>
    `;
  }

  private renderDropZone() {
    return html`
      <div
        class="drop-zone ${this.dragOver ? 'drag-over' : ''}"
        @click=${this.triggerFileInput}
        @dragover=${this.handleDragOver}
        @dragleave=${this.handleDragLeave}
        @drop=${this.handleDrop}
        role="button"
        tabindex="0"
        aria-label="Click or drag an image to upload"
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') this.triggerFileInput(); }}
      >
        <sl-icon name="cloud-arrow-up"></sl-icon>
        <span class="drop-text">Click or drag an image here</span>
        <span class="drop-hint">JPEG, PNG — max 5 MB</span>
      </div>
      <input
        type="file"
        id="file-input"
        accept="image/*"
        @change=${this.handleFileSelect}
      />
    `;
  }

  private renderEditor() {
    return html`
      <div class="canvases-row">
        <div class="canvas-section">
          <span class="canvas-label">Crop Area</span>
          <div class="canvas-wrapper">
            <canvas
              id="crop-canvas"
              width=${this.CROP_WIDTH}
              height=${this.CROP_HEIGHT}
              @mousedown=${this.handleMouseDown}
              @mousemove=${this.handleMouseMove}
              @mouseup=${this.handleMouseUp}
              @mouseleave=${this.handleMouseUp}
              @wheel=${this.handleWheel}
            ></canvas>
            <div class="zoom-controls">
              <button class="zoom-btn" @click=${this.zoomOut} title="Zoom Out" type="button">
                <sl-icon name="dash"></sl-icon>
              </button>
              <button class="zoom-btn" @click=${this.zoomIn} title="Zoom In" type="button">
                <sl-icon name="plus"></sl-icon>
              </button>
              <button class="zoom-btn" @click=${this.resetCrop} title="Reset / Center" type="button" style="font-size: 11px;">
                Reset
              </button>
            </div>
          </div>
          <span class="zoom-hint">Scroll or click to zoom · Drag to pan</span>
        </div>
        <div class="canvas-section">
          <span class="canvas-label">Preview</span>
          <canvas
            id="preview-canvas"
            width=${this.PREVIEW_WIDTH}
            height=${this.PREVIEW_HEIGHT}
          ></canvas>
        </div>
      </div>
      <input
        type="file"
        id="file-input"
        accept="image/*"
        @change=${this.handleFileSelect}
      />
    `;
  }

  // ─── PUBLIC API ───────────────────────────────────────────────

  public show() {
    this.reset();
    this.dialog.show();
  }

  public hide() {
    this.dialog.hide();
    this.reset();
  }

  // ─── FILE HANDLING ────────────────────────────────────────────

  private triggerFileInput() {
    this.fileInput?.click();
  }

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files?.length) {
      this.loadImage(input.files[0]);
    }
  }

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    this.dragOver = true;
  }

  private handleDragLeave() {
    this.dragOver = false;
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();
    this.dragOver = false;
    const file = e.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) {
      this.loadImage(file);
    }
  }

  private loadImage(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        this.image = img;
        this.imageLoaded = true;

        // Calculate initial zoom to fill the crop area
        const scaleX = this.CROP_WIDTH / img.width;
        const scaleY = this.CROP_HEIGHT / img.height;
        this.zoomLevel = Math.max(scaleX, scaleY);
        this.panX = 0;
        this.panY = 0;

        // Need to wait for canvas to be rendered
        this.updateComplete.then(() => this.redraw());
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ─── CANVAS INTERACTION ───────────────────────────────────────

  private handleMouseDown(e: MouseEvent) {
    this.dragging = true;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
  }

  private handleMouseMove(e: MouseEvent) {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastMouseX;
    const dy = e.clientY - this.lastMouseY;
    this.panX += dx;
    this.panY += dy;
    this.lastMouseX = e.clientX;
    this.lastMouseY = e.clientY;
    this.redraw();
  }

  private handleMouseUp() {
    this.dragging = false;
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.95 : 1.05;
    this.applyZoomDelta(delta);
  }

  private zoomIn() {
    this.applyZoomDelta(1.15);
  }

  private zoomOut() {
    this.applyZoomDelta(0.85);
  }

  private resetCrop() {
    if (!this.image) return;
    const scaleX = this.CROP_WIDTH / this.image.width;
    const scaleY = this.CROP_HEIGHT / this.image.height;
    this.zoomLevel = Math.max(scaleX, scaleY);
    this.panX = 0;
    this.panY = 0;
    this.redraw();
  }

  private applyZoomDelta(delta: number) {
    if (!this.image) return;
    const newZoom = this.zoomLevel * delta;
    const minZoom = Math.max(
      this.CROP_WIDTH / this.image.width,
      this.CROP_HEIGHT / this.image.height,
    ) * 0.5;
    const maxZoom = Math.max(
      this.CROP_WIDTH / this.image.width,
      this.CROP_HEIGHT / this.image.height,
    ) * 5;
    this.zoomLevel = Math.max(minZoom, Math.min(maxZoom, newZoom));
    this.redraw();
  }

  private redraw() {
    if (!this.image || !this.cropCanvas || !this.previewCanvas) return;

    // Draw crop canvas
    const ctx = this.cropCanvas.getContext('2d')!;
    ctx.clearRect(0, 0, this.CROP_WIDTH, this.CROP_HEIGHT);

    const scaledW = this.image.width * this.zoomLevel;
    const scaledH = this.image.height * this.zoomLevel;
    const x = (this.CROP_WIDTH - scaledW) / 2 + this.panX;
    const y = (this.CROP_HEIGHT - scaledH) / 2 + this.panY;

    ctx.drawImage(this.image, x, y, scaledW, scaledH);

    // Draw preview canvas
    const pctx = this.previewCanvas.getContext('2d')!;
    pctx.clearRect(0, 0, this.PREVIEW_WIDTH, this.PREVIEW_HEIGHT);

    const previewScale = this.PREVIEW_WIDTH / this.CROP_WIDTH;
    const px = x * previewScale;
    const py = y * previewScale;
    const psw = scaledW * previewScale;
    const psh = scaledH * previewScale;

    pctx.drawImage(this.image, px, py, psw, psh);
  }

  // ─── ACTIONS ──────────────────────────────────────────────────

  private async handleSave() {
    if (!this.image) return;

    this.saving = true;

    try {
      // Create offscreen canvas at output resolution
      const offscreen = document.createElement('canvas');
      offscreen.width = this.OUTPUT_WIDTH;
      offscreen.height = this.OUTPUT_HEIGHT;
      const octx = offscreen.getContext('2d')!;

      // Scale from crop canvas coordinates to output resolution
      const outputScale = this.OUTPUT_WIDTH / this.CROP_WIDTH;
      const scaledW = this.image.width * this.zoomLevel * outputScale;
      const scaledH = this.image.height * this.zoomLevel * outputScale;
      const x = (this.OUTPUT_WIDTH - scaledW) / 2 + this.panX * outputScale;
      const y = (this.OUTPUT_HEIGHT - scaledH) / 2 + this.panY * outputScale;

      octx.drawImage(this.image, x, y, scaledW, scaledH);

      // Export as JPEG blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        offscreen.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to export canvas'))),
          'image/jpeg',
          0.92,
        );
      });

      this.dispatchEvent(
        new CustomEvent('cover-saved', {
          detail: { blob },
          bubbles: true,
          composed: true,
        }),
      );

      this.hide();
    } catch (err) {
      console.error('Failed to save cover image:', err);
    } finally {
      this.saving = false;
    }
  }

  private handleRemove() {
    this.dispatchEvent(
      new CustomEvent('cover-removed', {
        bubbles: true,
        composed: true,
      }),
    );
    this.hide();
  }

  private handleCancel() {
    this.hide();
  }

  private reset() {
    this.image = null;
    this.imageLoaded = false;
    this.saving = false;
    this.dragOver = false;
    this.panX = 0;
    this.panY = 0;
    this.zoomLevel = 1;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yts-thumbnail-editor': YtsThumbnailEditor;
  }
}
