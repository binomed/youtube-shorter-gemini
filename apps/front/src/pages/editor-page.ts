import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import { Router, type BeforeEnterObserver, type RouterLocation } from '@vaadin/router';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '../components/short-player.js';
import { projectService } from '../services/project.service.js';
import { projectSignal, setProject } from '../state/project.state.js';
import type { ShortResponse } from '@youtube-shorter/shared';

@customElement('editor-page')
export class EditorPage extends SignalWatcher(LitElement) implements BeforeEnterObserver {
  @state() private shorts: ShortResponse[] = [];
  @state() private loading = true;

  async onBeforeEnter(location: RouterLocation) {
    const projectId = location.params.projectId as string;

    // Fetch project if not already loaded or if ID mismatch
    const currentProject = (projectSignal as any).value;
    if (!currentProject || currentProject.id !== projectId) {
      try {
        const project = await projectService.getProject(projectId);
        setProject(project);
      } catch (e) {
        console.error('Failed to load project:', e);
        // TODO: Navigate to dashboard or show error
      }
    }

    // Load shorts for the project
    await this.loadShorts();
  }

  private playShort(short: ShortResponse) {
    const player = this.shadowRoot?.querySelector('short-player') as any;
    if (player && player.videoElement) {
      player.videoElement.currentTime = short.startTime;
      player.videoElement.play();
    }
  }

  private async loadShorts() {
    const projectId = (projectSignal as any).value?.id;
    if (!projectId) {
      this.loading = false;
      return;
    }
    try {
      this.shorts = await projectService.getShorts(projectId);
    } catch (e) {
      console.error('Failed to load shorts:', e);
    }
    this.loading = false;
  }

  /**
   * Format seconds to MM:SS display
   */
  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
  static styles = css`
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      background: radial-gradient(circle at 50% 50%, #232334 0%, #111116 100%);
      color: #e2e8f0;
      font-family: 'Inter', sans-serif;
      overflow: hidden;
    .home-button-icon {
      color: #94a3b8;
      font-size: 20px;
      cursor: pointer;
      transition: color 0.2s;
    }

    .home-button-icon:hover {
      color: #f8fafc;
    }

    .layout {
      display: grid;
      grid-template-columns: 280px 1fr 340px;
      height: 100%;
      gap: 24px;
      padding: 24px;
      box-sizing: border-box;
    }

    /* Glass Panel Utilities */
    .glass-panel {
      background: var(--yts-glass-bg, rgba(30, 35, 50, 0.7));
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--yts-glass-border, rgba(99, 102, 241, 0.3));
      border-radius: 20px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    
    .panel-header {
      font-size: 16px;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 20px;
      display: flex;
      justify-content: flex-start; /* Changed from space-between */
      align-items: center;
      gap: 12px;
    }

    /* Left Sidebar: Source Segments */
    .sidebar-left {
      overflow-y: auto;
    }

    .segment-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    /* ... */
  `;

  render() {
    return html`
      <div class="layout">
        <!-- Left: Source segments (Shorts from Gemini) -->
        <aside class="glass-panel sidebar-left">
          <div class="panel-header">
            <sl-icon 
              name="house-door-fill" 
              class="home-button-icon" 
              @click="${() => Router.go('/')}"
              title="Back to Dashboard"
            ></sl-icon>
            <span>Source Segments</span>
          </div>
          <div class="segment-list">
            ${this.loading
        ? html`<div style="color:#64748b; text-align:center; padding:20px;">Loading shorts...</div>`
        : this.shorts.length === 0
          ? html`<div style="color:#64748b; text-align:center; padding:20px;">No shorts detected yet.</div>`
          : this.shorts.map(s => html`
                  <div class="segment-card" @click="${() => this.playShort(s)}">
                    <div class="segment-thumb">
                      ${s.thumbnailUrl
              ? html`<img src="${s.thumbnailUrl}" alt="${s.title}" style="width:100%; height:100%; object-fit:cover; border-radius:6px;">`
              : ''
            }
                    </div>
                    <div class="segment-info">
                      <div class="segment-title">${s.title}</div>
                      <div class="segment-meta">${this.formatTime(s.startTime)} - ${this.formatTime(s.endTime)}</div>
                    </div>
                  </div>
                `)
      }
          </div>
        </aside>

        <!-- Center: Reel -->
        <main class="reel-container">
          <!-- Short Player Component -->
          ${(projectSignal as any).value
        ? html`<short-player 
                src="/api/projects/${(projectSignal as any).value.id}/video" 
                caption="Irens thelne vante huigre Stens.. in abet lhe voe tenid anger nap."
              ></short-player>`
        : html`<div>Loading project...</div>`
      }
        </main>

        <!-- Right: Tools -->
        <aside class="glass-panel sidebar-right">
          <div class="tools-header">
            <span style="font-weight:600; color:#f8fafc;">Audio</span>
            <button class="export-btn">Export</button>
          </div>
          
          <sl-tab-group>
            <sl-tab slot="nav" panel="captions">Captions</sl-tab>
            <sl-tab slot="nav" panel="style">Style</sl-tab>
            
            <sl-tab-panel name="captions">
               <div class="captions-list">
                 ${[1, 2, 3, 4, 5].map(i => html`
                    <div class="caption-item">
                        <sl-icon name="lock" style="color:#64748b; font-size: 14px;"></sl-icon>
                        <div class="caption-text">Caption line number ${i} text content...</div>
                        <div class="caption-time">00:${i * 5}</div>
                    </div>
                 `)}
               </div>
            </sl-tab-panel>
            
            <sl-tab-panel name="style">
               <div style="color:#94a3b8; font-size:13px; text-align:center; padding-top:20px;">
                  Style controls coming soon...
               </div>
            </sl-tab-panel>
          </sl-tab-group>
        </aside>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'editor-page': EditorPage;
  }
}
