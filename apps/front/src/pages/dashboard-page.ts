import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import type SlDialog from '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import { projectService } from '../services/project.service.js';
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
      /* Theme Variables - Issue #12: Extract magic colors */
      --yts-glass-bg: rgba(30, 41, 59, 0.7);
      --yts-border: rgba(99, 102, 241, 0.6);
      --yts-primary: #4f46e5;
      --yts-primary-hover: #4338ca;
      --yts-text-1: #f8fafc;
      --yts-text-2: #cbd5e1;
      --yts-text-3: #94a3b8;
      
      background: radial-gradient(circle at 50% 50%, #232334 0%, #111116 100%);
      font-family: 'Inter', sans-serif;
    }

    .glass-card {
      width: 100%;
      max-width: 500px;
      padding: 48px;
      background: var(--yts-glass-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--yts-border);
      border-radius: 20px;
      box-shadow: 0 0 40px rgba(0, 0, 0, 0.5), 
                  0 0 15px rgba(99, 102, 241, 0.2),
                  inset 0 0 20px rgba(255, 255, 255, 0.02);
      position: relative;
      overflow: hidden;
      
      /* Restored min-height, removed fixed height */
      min-height: 520px;
      display: flex;
      flex-direction: column;
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
      color: var(--yts-text-3); /* Muted text */
      margin-bottom: 12px;
      font-weight: 500;
    }

    input[type="text"] {
      width: 100%;
      padding: 12px 0;
      background: transparent;
      border: none;
      /* Distinct blue line */
      border-bottom: 1px solid var(--yts-primary);
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
      color: var(--yts-text-1);
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
      color: var(--yts-text-3); /* Better contrast */
      text-align: center;
    }
    /* Browser Tab Styling */
    sl-tab-group {
      --indicator-color: transparent;
      --track-color: transparent;
      margin-top: -20px; /* Pull tabs closer to top */
    }

    sl-tab-group::part(nav) {
        /* Remove pill styling */
        padding: 0;
        margin-bottom: 0;
    }

    sl-tab {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-bottom: none;
      border-radius: 12px 12px 0 0;
      margin-right: 4px;
      color: var(--yts-text-3);
      font-weight: 500;
      transition: all 0.2s ease;
      padding: 0 24px;
      height: 48px; /* Fixed height for consistency */
    }

    sl-tab:hover {
      background: rgba(255, 255, 255, 0.08);
      color: var(--yts-text-2);
    }

    sl-tab[active] {
      background: rgba(99, 102, 241, 0.1); /* Subtle blue tint matching glass card */
      border: 1px solid var(--yts-border); /* Match card border */
      border-bottom: 1px solid transparent; /* seamless connection */
      color: var(--yts-text-1);
      font-weight: 600;
      text-shadow: 0 0 10px rgba(99, 102, 241, 0.5);
      position: relative;
      z-index: 1; /* Sit above the panel border */
      margin-bottom: -1px; /* Overlap panel border */
      box-shadow: none; /* Remove toggle shadow */
    }

    sl-tab-panel::part(base) {
        padding: 24px 0 0 0;
        border-top: 1px solid var(--yts-border); /* define top border of content area */
        margin-top: -1px; /* connected to tabs */
        position: relative;
        z-index: 0;
    }

    /* Custom scrollbar for project list */
    .project-list::-webkit-scrollbar {
        width: 6px;
    }
    
    .project-list::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.02);
    }
    
    .project-list::-webkit-scrollbar-thumb {
        background: rgba(99, 102, 241, 0.3);
        border-radius: 3px;
    }
    
    .project-list::-webkit-scrollbar-thumb:hover {
        background: rgba(99, 102, 241, 0.5);
    }

    .project-item:hover {
        background-color: rgba(255, 255, 255, 0.05);
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
  @state() private projects: any[] = [];
  @state() private projectIdToDelete: string | null = null; // Still need this state to track WHICH project to delete

  // Issue #7: Optimize DOM Access with @query decorator
  // Issue #6: Fix type safety (remove cast)
  @query('.delete-dialog') private deleteDialog!: SlDialog;

  connectedCallback() {
    super.connectedCallback();
    this.loadProjects();
  }

  private async loadProjects() {
    try {
      this.projects = await projectService.getProjects();
    } catch (error) {
      console.error('Failed to load projects:', error);
      // Ideally show a toast, but for now log is better than crash
    }
  }

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

  private handleDeleteProject(id: string, e: Event) {
    e.stopPropagation();
    this.projectIdToDelete = id;
    // Issue #7: Use cached query reference
    // Issue #6: Type-safe method call
    this.deleteDialog.show();
  }

  private async confirmDelete() {
    if (!this.projectIdToDelete) return;

    try {
      await projectService.deleteProject(this.projectIdToDelete);
      await this.loadProjects();
      this.deleteDialog.hide();
      this.projectIdToDelete = null;
    } catch (error) {
      console.error('Failed to delete project:', error);
      // Issue #13: Provide user feedback
      alert('Failed to delete project. Please try again.');
    }
  }

  private handleProjectClick(id: string) {
    window.history.pushState(null, '', `/editor/${id}`);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }

  /**
   * Renders the Create Project tab content
   * Issue #11: Monolithic Render Method -> Extracted helper
   */
  private renderCreateTab() {
    return html`
        <div style="padding-top: 20px;">
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
      `;
  }

  /**
   * Renders the Projects List tab content
   * Issue #11: Monolithic Render Method -> Extracted helper
   */
  private renderProjectsTab() {
    return html`
        <div class="project-list" style="padding-top: 20px; max-height: 400px; overflow-y: auto;">
            ${this.projects.length === 0 ? html`
                <div style="text-align: center; color: var(--yts-text-3); padding: 20px;">
                    No projects found. Create one first!
                </div>
            ` : html`
                ${this.projects.map(p => html`
                    <div class="project-item" @click=${() => this.handleProjectClick(p.id)} style="
                        display: flex; 
                        justify-content: space-between; 
                        align-items: center; 
                        padding: 12px; 
                        border-bottom: 1px solid rgba(255,255,255,0.05); 
                        cursor: pointer;
                        transition: background 0.2s;
                    ">
                        <div class="info">
                            <div style="font-weight: 500; color: var(--yts-text-1);">${p.name}</div>
                            <div style="font-size: 12px; color: #64748b;">
                                ${new Date(p.createdAt).toLocaleDateString()} • 
                                ${p.duration ? Math.round(p.duration) + 's' : 'Unknown duration'} •
                                ${p.isAnalyzed ? 'Analyzed' : 'In Progress'}
                            </div>
                        </div>
                        <div class="actions">
                            <sl-icon-button 
                                name="trash" 
                                label="Delete" 
                                style="color: #ef4444;"
                                @click=${(e: Event) => this.handleDeleteProject(p.id, e)}
                            ></sl-icon-button>
                        </div>
                    </div>
                `)}
            `}
        </div>
      `;
  }

  render() {
    return html`
      <div class="glass-card">
        <sl-tab-group>
            <sl-tab slot="nav" panel="create">Create</sl-tab>
            <sl-tab slot="nav" panel="projects" @click=${this.loadProjects}>Projects</sl-tab>

            <sl-tab-panel name="create">
                ${this.renderCreateTab()}
            </sl-tab-panel>

            <sl-tab-panel name="projects">
                ${this.renderProjectsTab()}
            </sl-tab-panel>
        </sl-tab-group>
      </div>
      
      <div class="star-deco">
        ✦
      </div>

      <sl-dialog label="Delete Project" class="delete-dialog">
        Are you sure you want to delete this project? This action cannot be undone.
        <div slot="footer">
          <sl-button variant="neutral" @click=${() => this.deleteDialog.hide()}>
            Cancel
          </sl-button>
          <sl-button variant="danger" @click=${this.confirmDelete}>
            Delete
          </sl-button>
        </div>
      </sl-dialog>
    `;
  }
}
