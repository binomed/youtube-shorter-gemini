import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import { classMap } from 'lit/directives/class-map.js';

@customElement('dashboard-page')
export class DashboardPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      /* Lighter dark background for better contrast with the card */
      background: radial-gradient(circle at 50% 50%, #232334 0%, #111116 100%);
      font-family: 'Inter', sans-serif;
    }

    .glass-card {
      width: 100%;
      max-width: 500px; /* Matching the mockup size */
      padding: 48px;
      /* More distinct glass effect */
      background: var(--yts-glass-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      
      /* Stronger thin blue border */
      border: 1px solid rgba(99, 102, 241, 0.6);
      border-radius: 20px;
      
      /* Outer blue glow */
      box-shadow: 0 0 40px rgba(0, 0, 0, 0.5), 
                  0 0 15px rgba(99, 102, 241, 0.2),
                  inset 0 0 20px rgba(255, 255, 255, 0.02);
      
      position: relative;
      overflow: hidden;
    }
    
    /* Top highlight line simulating light source */
    .glass-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 20%;
        right: 20%;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(165, 180, 252, 0.8), transparent);
        box-shadow: 0 0 10px rgba(165, 180, 252, 0.5);
    }

    .input-group {
      margin-bottom: 40px;
      position: relative;
    }

    label {
      display: block;
      font-size: 15px;
      color: #94a3b8; /* Muted text */
      margin-bottom: 12px;
      font-weight: 500;
    }

    input[type="text"] {
      width: 100%;
      padding: 12px 0;
      background: transparent;
      border: none;
      /* Distinct blue line */
      border-bottom: 1px solid #4f46e5;
      color: #f1f5f9; /* Bright text */
      font-size: 16px;
      transition: all 0.3s ease;
      font-family: inherit;
    }

    input[type="text"]:focus {
      outline: none;
      border-bottom-color: #818cf8;
      box-shadow: 0 2px 0 rgba(129, 140, 248, 0.2);
    }
    
    input[type="text"]::placeholder {
        color: #475569;
    }

    .drop-zone {
      /* Strong dashed blue border */
      border: 2px dashed rgba(99, 102, 241, 0.5);
      border-radius: 16px;
      height: 200px;
      /* Subtle blue interior */
      background: rgba(99, 102, 241, 0.03);
      cursor: pointer;
      transition: all 0.3s ease;
      margin-bottom: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
    }

    .drop-zone:hover, .drop-zone.drag-active {
      background: rgba(99, 102, 241, 0.08);
      border-color: #6366f1;
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.2);
    }

    .icon-wrapper {
        color: #e2e8f0; /* White icon */
        transition: transform 0.3s ease;
    }
    
    .drop-zone:hover .icon-wrapper {
        transform: scale(1.1);
    }
    
    .drop-text {
      color: #f8fafc;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: 0.02em;
      text-align: center;
    }

    .actions {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    button.neon-btn {
      /* Vibrant Royal Blue gradient */
      background: linear-gradient(135deg, #4338ca 0%, #6366f1 100%);
      border: none;
      /* Top inner highlight */
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      color: white;
      font-weight: 600;
      padding: 14px 48px;
      font-size: 15px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(79, 70, 229, 0.4); /* Blue glow */
      transition: all 0.2s ease;
    }

    button.neon-btn:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(79, 70, 229, 0.6);
      filter: brightness(1.1);
    }
    
    button.neon-btn:active {
        transform: translateY(0);
    }

    button.neon-btn:disabled {
      background: #334155;
      color: #64748b;
      cursor: not-allowed;
      box-shadow: none;
      border: none;
    }

    .footer-note {
      margin-top: 24px;
      font-size: 13px;
      color: #94a3b8; /* Better contrast */
      text-align: center;
    }
    
    .star-deco {
        position: fixed;
        bottom: 40px;
        right: 40px;
        color: #e2e8f0;
        opacity: 0.6;
        font-size: 28px;
        filter: drop-shadow(0 0 5px white);
    }
  `;

  @state() private projectName = '';
  @state() private isDragActive = false;
  @state() private selectedFile: File | null = null;

  private handleDragOver(e: DragEvent) {
    e.preventDefault();
    this.isDragActive = true;
  }

  private handleDragLeave(e: DragEvent) {
    e.preventDefault();
    this.isDragActive = false;
  }

  private handleDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragActive = false;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        this.selectedFile = file;
        if (!this.projectName) {
          this.projectName = file.name.replace(/\.[^/.]+$/, "");
        }
      }
    }
  }

  private handleFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.selectedFile = input.files[0];
      if (!this.projectName) {
        this.projectName = input.files[0].name.replace(/\.[^/.]+$/, "");
      }
    }
  }

  private handleCreateProject() {
    if (!this.projectName || !this.selectedFile) return;

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
      <div class="glass-card">
        
        <div class="input-group">
          <label for="project-name">Project Name</label>
          <input 
            type="text" 
            id="project-name" 
            .value=${this.projectName}
            @input=${(e: Event) => this.projectName = (e.target as HTMLInputElement).value}
            placeholder="Enter project name..."
            autocomplete="off"
          >
        </div>

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
            <div class="icon-wrapper">
                <sl-icon name="file-earmark-play" style="font-size: 48px;"></sl-icon>
            </div>
            <div class="drop-text">${this.selectedFile.name}</div>
          ` : html`
            <div class="icon-wrapper">
                <sl-icon name="cloud-upload" style="font-size: 64px;"></sl-icon>
            </div>
            <div class="drop-text">Drop Video Here</div>
          `}
        </div>

        <div class="actions">
          <button 
            class="neon-btn" 
            @click=${this.handleCreateProject} 
            ?disabled=${!this.projectName || !this.selectedFile}
          >
            Create Project
          </button>
          
          <div class="footer-note">
            Files are processed locally.
          </div>
        </div>
      </div>
      
      <div class="star-deco">
        ✦
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'dashboard-page': DashboardPage;
  }
}
