/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import type { ProjectResponse } from '@youtube-shorter/shared';
import { projectService } from '../../services/project.service.js';

import '@shoelace-style/shoelace/dist/components/input/input.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/progress-bar/progress-bar.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import '@shoelace-style/shoelace/dist/themes/dark.css';

/**
 * Project creation form with drag & drop video upload.
 *
 * Features:
 * - Project name input with validation
 * - Drag & drop file zone + click-to-browse fallback
 * - Client-side format and size validation
 * - Upload progress bar
 * - Privacy notice (FR-03 compliance)
 * - WCAG 2.1 AA keyboard navigation
 *
 * @fires project-created - Dispatched when a project is successfully created
 * @element yts-project-form
 */
@customElement('yts-project-form')
export class YtsProjectForm extends LitElement {
    @state() private projectName = '';
    @state() private selectedFile: File | null = null;
    @state() private uploadProgress = 0;
    @state() private isUploading = false;
    @state() private errorMessage = '';
    @state() private isDragOver = false;
    @state() private deletionPolicyAcknowledged = false;
    @state() private aiLearningConsent = false;

    // Configuration from backend
    @state() private maxFileSizeMb = 500; // Default fallback
    @state() private allowedExtensions: string[] = ['.mp4', '.mov']; // Default fallback
    @state() private allowedMimeTypes: string[] = ['video/mp4', 'video/quicktime']; // Default fallback

    @query('#file-input') private fileInput!: HTMLInputElement;

    static styles = css`
        :host {
            display: block;
            width: 100%;
            max-width: 520px;
        }

        /* ===== Layout ===== */
        .form-container {
            background: var(--yts-bg-card);
            border: 1px solid var(--yts-border);
            border-radius: var(--yts-radius-xl);
            padding: var(--yts-spacing-2xl);
            box-shadow: var(--yts-shadow-lg);
            /* Centered layout constrained by max-width on :host */
        }


        /* ===== Typography ===== */
        .form-header {
            text-align: center;
            margin-bottom: var(--yts-spacing-xl);
        }

        .form-header h1 {
            font-size: var(--yts-font-size-2xl);
            font-weight: 700;
            margin-bottom: var(--yts-spacing-xs);
            /* Gradient text effect */
            background: linear-gradient(135deg, var(--yts-accent), var(--yts-accent-hover));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .form-header p {
            font-size: var(--yts-font-size-sm);
            color: var(--yts-text-secondary);
        }

        /* ===== Form Fields ===== */
        .field {
            margin-bottom: var(--yts-spacing-lg);
        }

        .field label {
            display: block;
            font-size: var(--yts-font-size-sm);
            font-weight: 500;
            color: var(--yts-text-secondary);
            margin-bottom: var(--yts-spacing-xs);
        }

        /* ===== Drag & Drop Zone ===== */
        /* Handles default, hover, drag-over, and populated states */
        .dropzone {
            border: 2px dashed var(--yts-border);
            border-radius: var(--yts-radius-lg);
            padding: var(--yts-spacing-2xl) var(--yts-spacing-lg);
            text-align: center;
            cursor: pointer;
            transition: all var(--yts-transition-normal);
            background: transparent;
            /* Focus ring handled by outlines on tabindex element */
        }

        .dropzone:hover,
        .dropzone.drag-over {
            border-color: var(--yts-accent);
            background: rgba(99, 102, 241, 0.05);
        }

        .dropzone.drag-over {
            box-shadow: var(--yts-shadow-glow);
        }

        .dropzone.has-file {
            border-color: var(--yts-success);
            background: rgba(34, 197, 94, 0.05);
        }

        .dropzone-icon {
            font-size: 2.5rem;
            margin-bottom: var(--yts-spacing-sm);
            color: var(--yts-text-secondary);
        }

        .dropzone.has-file .dropzone-icon {
            color: var(--yts-success);
        }

        .dropzone-text {
            font-size: var(--yts-font-size-sm);
            color: var(--yts-text-secondary);
        }

        .dropzone-text strong {
            color: var(--yts-accent);
        }

        .dropzone-hint {
            font-size: var(--yts-font-size-xs);
            color: var(--yts-text-muted);
            margin-top: var(--yts-spacing-xs);
        }

        .file-info {
            margin-top: var(--yts-spacing-sm);
            font-size: var(--yts-font-size-sm);
            color: var(--yts-text-primary);
        }

        .file-info .file-name {
            font-weight: 500;
        }

        .file-info .file-size {
            color: var(--yts-text-muted);
            margin-left: var(--yts-spacing-xs);
        }

        #file-input {
            display: none;
        }

        /* ===== Privacy Notice ===== */
        .privacy-notice {
            display: flex;
            align-items: flex-start;
            gap: var(--yts-spacing-sm);
            padding: var(--yts-spacing-md);
            background: rgba(99, 102, 241, 0.08);
            border-radius: var(--yts-radius-md);
            font-size: var(--yts-font-size-xs);
            color: var(--yts-text-secondary);
            margin-bottom: var(--yts-spacing-lg);
            line-height: 1.5;
        }

        .privacy-icon {
            font-size: 1.2rem;
            flex-shrink: 0;
            margin-top: -2px;
            color: var(--yts-accent);
        }

        .checkbox-group {
            display: flex;
            flex-direction: column;
            gap: var(--yts-spacing-sm);
            margin-bottom: var(--yts-spacing-lg);
        }

        /* ===== Progress ===== */
        .progress-section {
            margin-bottom: var(--yts-spacing-lg);
        }

        .progress-label {
            font-size: var(--yts-font-size-sm);
            color: var(--yts-text-secondary);
            margin-bottom: var(--yts-spacing-xs);
        }

        /* ===== Submit Button ===== */
        .submit-section {
            display: flex;
            justify-content: center;
        }

        sl-button::part(base) {
            width: 100%;
        }

        /* ===== Error ===== */
        .error-container {
            margin-bottom: var(--yts-spacing-lg);
        }

        /* Material Icons sizing */
        .material-symbols-outlined {
            font-size: inherit;
            vertical-align: middle;
        }
    `;

    /**
     * Lifecycle callback: Called when element is added to DOM.
     * Fetches upload configuration (max size, allowed formats) from backend.
     */
    async connectedCallback(): Promise<void> {
        super.connectedCallback();
        try {
            const config = await projectService.getConfig();
            this.maxFileSizeMb = config.maxVideoSizeMb;
            this.allowedExtensions = config.allowedExtensions;
            this.allowedMimeTypes = config.allowedMimeTypes;
        } catch (e) {
            console.error('Failed to load upload config', e);
        }
    }

    /**
     * Renders the component HTML
     */
    render(): unknown {
        return html`
            <div class="form-container" @sl-theme-dark>
                <!-- 1. Form Header: Title and description -->
                <div class="form-header">
                    <h1>New Project</h1>
                    <p>Upload a video to start creating Shorts</p>
                </div>

                <!-- 2. Global Error Message Display -->
                ${this.errorMessage
                ? html`
                          <div class="error-container">
                              <sl-alert variant="danger" open>
                                  <span slot="icon" class="material-symbols-outlined">error</span>
                                  <strong>Error:</strong> ${this.errorMessage}
                              </sl-alert>
                          </div>
                      `
                : ''}

                <!-- 3. Project Name Input -->
                <div class="field">
                    <label for="project-name">Project Name</label>
                    <sl-input
                        id="project-name"
                        placeholder="My Awesome Short"
                        maxlength="255"
                        .value=${this.projectName}
                        @sl-input=${this._onNameInput}
                        ?disabled=${this.isUploading}
                        required
                    ></sl-input>
                </div>

                <!-- 4. Video File Upload Zone (Drag & Drop + Click) -->
                <div class="field">
                    <label>Video File</label>
                    <div
                        class="dropzone ${this.isDragOver ? 'drag-over' : ''} ${this.selectedFile ? 'has-file' : ''}"
                        role="button"
                        tabindex="0"
                        aria-label="Drop a video file here or click to browse"
                        @click=${this._onDropzoneClick}
                        @keydown=${this._onDropzoneKeydown}
                        @dragover=${this._onDragOver}
                        @dragleave=${this._onDragLeave}
                        @drop=${this._onDrop}
                    >
                        ${this.selectedFile
                ? html`
                                  <!-- State: File Selected -->
                                  <div class="dropzone-icon">
                                      <span class="material-symbols-outlined" style="font-size: 48px;">check_circle</span>
                                  </div>
                                  <div class="file-info">
                                      <span class="file-name">${this.selectedFile.name}</span>
                                      <span class="file-size">(${this._formatFileSize(this.selectedFile.size)})</span>
                                  </div>
                                  <div class="dropzone-hint">Click to change file</div>
                              `
                : html`
                                  <!-- State: Empty / Prompt -->
                                  <div class="dropzone-icon">
                                      <span class="material-symbols-outlined" style="font-size: 48px;">cloud_upload</span>
                                  </div>
                                  <div class="dropzone-text">
                                      <strong>Drop your video here</strong> or click to browse
                                  </div>
                                  <div class="dropzone-hint">
                                      ${this.allowedExtensions.map(ext => ext.replace('.', '').toUpperCase()).join(', ')} — Max ${this.maxFileSizeMb < 1024 ? this.maxFileSizeMb + 'MB' : (this.maxFileSizeMb / 1024).toFixed(0) + 'GB'}
                                  </div>
                              `}
                    </div>
                    <input
                        id="file-input"
                        type="file"
                        accept="${this.allowedExtensions.join(',')}"
                        @change=${this._onFileSelected}
                    />
                </div>

                <!-- 5. Privacy Information (FR-03: Deletion Policy) -->
                <div class="privacy-notice" role="note" aria-label="Privacy notice">
                    <span class="privacy-icon material-symbols-outlined">lock</span>
                    <span>
                        Your video stays on your machine. All processing is done locally.
                        Project data can be deleted at any time from the application settings.
                    </span>
                </div>

                <!-- 6. User Consent Checkboxes -->
                <div class="checkbox-group">
                    <!-- Mandatory Deletion Policy Acknowledgment -->
                    <sl-checkbox
                        ?checked=${this.deletionPolicyAcknowledged}
                        @sl-change=${(e: CustomEvent): void => { this.deletionPolicyAcknowledged = (e.target as HTMLInputElement).checked; }}
                    >
                        I acknowledge that my video is processed locally and I can delete project data at any time.
                    </sl-checkbox>

                    <!-- Optional AI Learning Consent -->
                    <sl-checkbox
                        ?checked=${this.aiLearningConsent}
                        @sl-change=${(e: CustomEvent): void => { this.aiLearningConsent = (e.target as HTMLInputElement).checked; }}
                    >
                        I agree to share anonymized data to help improve AI features (Optional).
                    </sl-checkbox>
                </div>

                <!-- 7. Upload Progress Indicator -->
                ${this.isUploading
                ? html`
                          <div class="progress-section">
                              <div class="progress-label">
                                  Uploading... ${this.uploadProgress}%
                              </div>
                              <sl-progress-bar
                                  .value=${this.uploadProgress}
                              ></sl-progress-bar>
                          </div>
                      `
                : ''}

                <!-- 8. Submit Action -->
                <div class="submit-section">
                    <sl-button
                        variant="primary"
                        size="large"
                        ?disabled=${!this._isFormValid() || this.isUploading}
                        ?loading=${this.isUploading}
                        @click=${this._onSubmit}
                    >
                        ${this.isUploading ? 'Uploading...' : 'Create Project'}
                    </sl-button>
                </div>
            </div>
        `;
    }

    // ─── Event Handlers ──────────────────────────

    private _onNameInput(e: Event): void {
        const input = e.target as HTMLInputElement;
        this.projectName = input.value;
        this.errorMessage = '';
    }

    private _onDropzoneClick(): void {
        if (!this.isUploading) {
            this.fileInput.click();
        }
    }

    private _onDropzoneKeydown(e: KeyboardEvent): void {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._onDropzoneClick();
        }
    }

    private _onDragOver(e: DragEvent): void {
        e.preventDefault();
        this.isDragOver = true;
    }

    private _onDragLeave(): void {
        this.isDragOver = false;
    }

    private _onDrop(e: DragEvent): void {
        e.preventDefault();
        this.isDragOver = false;

        const file = e.dataTransfer?.files?.[0];
        if (file) {
            this._validateAndSetFile(file);
        }
    }

    private _onFileSelected(e: Event): void {
        const input = e.target as HTMLInputElement;
        const file = input.files?.[0];
        if (file) {
            this._validateAndSetFile(file);
        }
    }

    /**
     * Handles form submission.
     * Uploads the file via ProjectService and dispatches success/error events.
     */
    private async _onSubmit(): Promise<void> {
        if (!this._isFormValid() || this.isUploading) return;

        this.isUploading = true;
        this.errorMessage = '';
        this.uploadProgress = 0;

        try {
            const project = await projectService.createProject(
                {
                    name: this.projectName.trim(),
                    deletionPolicyAcknowledged: this.deletionPolicyAcknowledged,
                    aiLearningConsent: this.aiLearningConsent,
                },
                this.selectedFile!,
                (progress) => {
                    this.uploadProgress = progress;
                },
            );

            // Dispatch success event
            this.dispatchEvent(
                new CustomEvent<ProjectResponse>('project-created', {
                    detail: project,
                    bubbles: true,
                    composed: true,
                }),
            );
        } catch (error) {
            this.errorMessage =
                error instanceof Error
                    ? error.message
                    : 'An unexpected error occurred';
        } finally {
            this.isUploading = false;
        }
    }

    // ─── Validation ──────────────────────────

    /**
     * Validates the selected file against client-side rules (size, type).
     * Also auto-fills project name if empty.
     * @param file - The file selected by user
     */
    private _validateAndSetFile(file: File): void {
        this.errorMessage = '';

        // Check MIME type
        if (!this.allowedMimeTypes.includes(file.type)) {
            this.errorMessage = `Invalid file format "${file.name}". Only ${this.allowedExtensions.map(e => e.replace('.', '').toUpperCase()).join(' and ')} files are accepted.`;
            return;
        }

        // Check extension
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!this.allowedExtensions.includes(ext)) {
            this.errorMessage = `Invalid file extension "${ext}". Only ${this.allowedExtensions.join(', ')} are accepted.`;
            return;
        }

        // Check size
        const maxBytes = this.maxFileSizeMb * 1024 * 1024;
        if (file.size > maxBytes) {
            this.errorMessage = `File is too large (${this._formatFileSize(file.size)}). Maximum allowed: ${this.maxFileSizeMb < 1024 ? this.maxFileSizeMb + 'MB' : (this.maxFileSizeMb / 1024).toFixed(0) + 'GB'}.`;
            return;
        }

        this.selectedFile = file;

        // Auto-fill project name if empty
        if (!this.projectName) {
            this.projectName = file.name.replace(/\.[^/.]+$/, "");
        }
    }

    /**
     * Checks if the form is ready for submission.
     * Requires: Project Name, Review of Deletion Policy, and a Valid File.
     */
    private _isFormValid(): boolean {
        return (
            this.projectName.trim().length > 0 &&
            this.selectedFile !== null &&
            this.deletionPolicyAcknowledged
        );
    }

    // ─── Helpers ──────────────────────────

    private _formatFileSize(bytes: number): string {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024)
            return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
}

declare global {
    interface HTMLElementTagNameMap {
        'yts-project-form': YtsProjectForm;
    }
}
