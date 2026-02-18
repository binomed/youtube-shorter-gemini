/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/alert/alert.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import { classMap } from 'lit/directives/class-map.js';

/**
 * Dashboard page component.
 * 
 * Features:
 * - Project creation interface
 * - Drag & drop video upload
 * - Form validation
 * - Navigation to Editor upon success
 * 
 * @element dashboard-page
 */
@customElement('dashboard-page')
export class DashboardPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: var(--yts-bg-primary);
    }

    .container {
      width: 100%;
      max-width: 600px;
      padding: var(--yts-spacing-xl);
      background-color: var(--yts-bg-card);
      border-radius: var(--yts-radius-xl);
      box-shadow: var(--yts-shadow-lg), var(--yts-shadow-glow);
      text-align: center;
    }

    h1 {
      font-size: var(--yts-font-size-2xl);
      margin-bottom: var(--yts-spacing-lg);
      font-weight: 600;
    }

    .input-group {
      margin-bottom: var(--yts-spacing-lg);
      text-align: left;
    }

    label {
      display: block;
      margin-bottom: var(--yts-spacing-xs);
      font-size: var(--yts-font-size-sm);
      color: var(--yts-text-secondary);
    }

    input[type="text"] {
      width: 100%;
      padding: var(--yts-spacing-md);
      background-color: var(--yts-bg-secondary);
      border: 1px solid var(--yts-border);
      border-radius: var(--yts-radius-md);
      color: var(--yts-text-primary);
      font-size: var(--yts-font-size-base);
      transition: border-color var(--yts-transition-fast);
    }

    input[type="text"]:focus {
      outline: none;
      border-color: var(--yts-accent);
    }

    .drop-zone {
      border: 2px dashed var(--yts-border);
      border-radius: var(--yts-radius-lg);
      padding: var(--yts-spacing-2xl);
      background-color: var(--yts-bg-secondary);
      cursor: pointer;
      transition: all var(--yts-transition-normal);
      margin-bottom: var(--yts-spacing-xl);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--yts-spacing-md);
    }

    .drop-zone:hover, .drop-zone.drag-active {
      border-color: var(--yts-accent);
      background-color: var(--yts-bg-hover);
    }

    .drop-zone.drag-active {
      transform: scale(1.02);
    }
    
    .icon-upload {
      width: 48px;
      height: 48px;
      color: var(--yts-text-muted);
    }

    .drop-text {
      color: var(--yts-text-secondary);
      font-size: var(--yts-font-size-lg);
    }

    .drop-subtext {
      color: var(--yts-text-muted);
      font-size: var(--yts-font-size-sm);
    }

    .actions {
      display: flex;
      justify-content: center;
    }

    sl-button::part(base) {
      background-color: var(--yts-accent);
      border-color: var(--yts-accent);
      color: white;
      font-weight: 600;
      padding: 0 var(--yts-spacing-xl);
    }

    sl-button::part(base):hover {
      background-color: var(--yts-accent-hover);
      border-color: var(--yts-accent-hover);
    }

    .footer-note {
      margin-top: var(--yts-spacing-xl);
      font-size: var(--yts-font-size-xs);
      color: var(--yts-text-muted);
    }
  `;

  @state() private projectName = '';
  @state() private isDragActive = false;
  @state() private selectedFile: File | null = null;
  @state() private errorMessage = '';

  /**
   * Handles dragover event to show visual feedback.
   */
  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragActive = true;
  }

  private handleDragLeave(e: DragEvent) {
    e.preventDefault();
    this.isDragActive = false;
  }

  /**
   * Handles file drop event.
   * Validates that the dropped file is a video and updates state.
   */
  private handleDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragActive = false;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        this.selectedFile = file;
        this.errorMessage = '';
        // Auto-fill project name from filename if empty
        if (!this.projectName) {
          this.projectName = file.name.split('.').slice(0, -1).join('.');
        }
      } else {
        this.errorMessage = 'Please drop a valid video file.';
      }
    }
  }

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      if (!this.projectName) {
        this.projectName = input.files[0].name.split('.').slice(0, -1).join('.');
      }
    }
  }

  /**
   * Validates form and emits 'create-project' event.
   */
  private handleCreateProject() {
    if (!this.projectName || !this.selectedFile) {
      return;
    }

    // Emit event to be handled by yts-app
    this.dispatchEvent(new CustomEvent('create-project', {
      detail: {
        name: this.projectName,
        file: this.selectedFile
      },
      bubbles: true,
      composed: true
    }));
  }

  private triggerFileInput() {
    const fileInput = this.shadowRoot?.querySelector('#file-input') as HTMLInputElement;
    fileInput?.click();
  }

  render() {
    return html`
      <div class="container">
        <h1>New Project</h1>
        
        ${this.errorMessage ? html`
          <sl-alert variant="danger" open class="error-alert">
            <sl-icon slot="icon" name="exclamation-circle"></sl-icon>
            <strong>Error:</strong> ${this.errorMessage}
          </sl-alert>
          <style>
            .error-alert { margin-bottom: var(--yts-spacing-lg); text-align: left; }
          </style>
        ` : ''}
        
        <h1>New Project</h1>
        
        <!-- Project Name Input -->
        <div class="input-group">
          <label for="project-name">Project Name</label>
          <input 
            type="text" 
            id="project-name" 
            .value=${this.projectName}
            @input=${(e: Event) => this.projectName = (e.target as HTMLInputElement).value}
            placeholder="Enter project name..."
          >
        </div>

        <!-- Drag & Drop Zone -->
        <div 
          class=${classMap({ 'drop-zone': true, 'drag-active': this.isDragActive })}
          @dragover=${this.handleDragOver}
          @dragleave=${this.handleDragLeave}
          @drop=${this.handleDrop}
          @click=${this.triggerFileInput}
        >
          <input 
            type="file" 
            id="file-input" 
            accept="video/*" 
            style="display: none" 
            @change=${this.handleFileSelect}
          >
          
          ${this.selectedFile ? html`
            <div class="icon-upload">🎬</div>
            <div class="drop-text">${this.selectedFile.name}</div>
            <div class="drop-subtext">(${(this.selectedFile.size / (1024 * 1024)).toFixed(2)} MB)</div>
          ` : html`
            <svg class="icon-upload" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div class="drop-text">Drop Video Here</div>
            <div class="drop-subtext">or click to browse</div>
          `}
        </div>

        <!-- Actions -->
        <div class="actions">
          <sl-button size="large" @click=${this.handleCreateProject} ?disabled=${!this.projectName || !this.selectedFile}>
            Create Project
          </sl-button>
        </div>

        <div class="footer-note">
          Files are processed locally and deleted after the session.
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-page': DashboardPage;
  }
}
