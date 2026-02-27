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
import '@shoelace-style/shoelace/dist/components/spinner/spinner.js';
import '@shoelace-style/shoelace/dist/components/badge/badge.js';
import '../components/short-player.js';
import '../components/molecules/yts-subtitle-editor.element.js';
import '../components/molecules/yts-subtitle-style-panel.element.js';
import { projectService } from '../services/project.service.js';
import { projectSignal, setProject } from '../state/project.state.js';
import type { ShortResponse, StemProgressEvent, SubtitleResponse } from '@youtube-shorter/shared';

@customElement('editor-page')
export class EditorPage extends SignalWatcher(LitElement) implements BeforeEnterObserver {
  @state() private shorts: ShortResponse[] = [];
  @state() private currentShort: ShortResponse | null = null;
  @state() private loading = true;
  @state() private stemSeparating = false;
  @state() private stemProgress = 0;
  @state() private stemMessage = '';
  @state() private stemAvailable = false;
  @state() private editingSubtitle: SubtitleResponse | null = null;
  @state() private activeTab: 'captions' | 'style' | 'audio' = 'style';

  async onBeforeEnter(location: RouterLocation): Promise<void> {
    const projectId = location.params.projectId as string;
    // Fetch project if not already loaded or if ID mismatch
    const currentProject = projectSignal.get();
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

  private playShort(short: ShortResponse): void {
    this.currentShort = short;
    // Reset progress state
    this.stemProgress = 0;
    this.stemMessage = '';
    this.stemSeparating = false;
    // Restore persisted stems state from the API response
    this.stemAvailable = short.stemsAvailable ?? false;

    const player = this.shadowRoot?.querySelector('short-player') as unknown as { playSegment: (s: number, e: number) => void };
    if (player && player.playSegment) {
      player.playSegment(short.startTime, short.endTime);
    }
  }

  private handleEditSubtitle(e: CustomEvent): void {
    const subtitle = e.detail.subtitle;
    this.editingSubtitle = subtitle;
  }

  private async handleSaveSubtitle(e: CustomEvent): Promise<void> {
    const { subtitleId, text } = e.detail;

    // Optimistic UI update
    if (this.currentShort && this.currentShort.subtitles) {
      const subIndex = this.currentShort.subtitles.findIndex((s) => s.id === subtitleId);
      if (subIndex > -1) {
        this.currentShort.subtitles[subIndex].text = text;
        this.currentShort = { ...this.currentShort }; // Trigger Lit update

        try {
          const projectId = projectSignal.get()?.id;
          if (projectId) {
            await fetch(`/api/projects/${projectId}/shorts/${this.currentShort.id}/subtitles/${subtitleId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
          }
        } catch (err) {
          console.error('Failed to save subtitle text:', err);
        }
      }
    }
    this.editingSubtitle = null;
  }

  private handleCancelEdit(): void {
    this.editingSubtitle = null;
  }

  private async handleStyleChange(e: CustomEvent): Promise<void> {
    const newStyle = e.detail.subtitleStyle;
    if (this.currentShort) {
      this.currentShort.subtitleStyle = newStyle;
      this.currentShort = { ...this.currentShort }; // Trigger Lit update

      try {
        const projectId = projectSignal.get()?.id;
        if (projectId) {
          await fetch(`/api/projects/${projectId}/shorts/${this.currentShort.id}/style`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStyle)
          });
        }
      } catch (err) {
        console.error('Failed to save subtitle style:', err);
      }
    }
  }

  private async handleApplyAllStyles(): Promise<void> {
    if (!this.currentShort || !this.currentShort.subtitleStyle) return;

    const projectId = projectSignal.get()?.id;
    if (!projectId) return;

    const styleToApply = this.currentShort.subtitleStyle;

    this.loading = true;
    try {
      await Promise.all(this.shorts.map(async (short) => {
        // Skip current since it's already saved via style-changed event right before
        if (short.id === this.currentShort?.id) return;

        short.subtitleStyle = { ...styleToApply };

        await fetch(`/api/projects/${projectId}/shorts/${short.id}/style`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(styleToApply)
        });
      }));

      this.shorts = [...this.shorts]; // Trigger re-render to reflect changes if needed
    } catch (err) {
      console.error('Failed to apply styles to all shorts:', err);
    } finally {
      this.loading = false;
    }
  }

  /**
   * Trigger stem separation for the current short.
   */
  private async triggerStemSeparation(): Promise<void> {
    const projectId = projectSignal.get()?.id;
    const shortId = this.currentShort?.id;
    if (!projectId || !shortId) return;

    this.stemSeparating = true;
    this.stemProgress = 0;
    this.stemMessage = 'Starting stem separation...';

    // Connect SSE for progress
    const eventSource = new EventSource(
      `/api/projects/${projectId}/shorts/${shortId}/stems/progress`
    );

    eventSource.addEventListener('stem-progress', (event: Event): void => {
      const data = JSON.parse((event as MessageEvent).data) as StemProgressEvent;
      this.stemProgress = data.progress;
      this.stemMessage = data.message;

      if (data.phase === 'complete') {
        this.stemSeparating = false;
        this.stemAvailable = true;
        eventSource.close();
      } else if (data.phase === 'error') {
        this.stemSeparating = false;
        eventSource.close();
      }
    });

    eventSource.onerror = (): void => {
      eventSource.close();
    };

    // Trigger the actual separation
    try {
      const response = await fetch(
        `/api/projects/${projectId}/shorts/${shortId}/stems`,
        { method: 'POST' }
      );
      const result = await response.json();
      if (result.success) {
        this.stemAvailable = true;
      }
    } catch (e) {
      console.error('Stem separation failed:', e);
      this.stemMessage = 'Stem separation failed.';
    } finally {
      this.stemSeparating = false;
      eventSource.close();
    }
  }

  private async loadShorts(): Promise<void> {
    const projectId = projectSignal.get()?.id;
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

    .sidebar-right {
      background: #1e202a; /* Deep navy from mockup */
      border: 1px solid rgba(255,255,255,0.05); /* Very subtle border */
      box-shadow: none;
      padding: 16px;
    }

    .tools-header {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 24px;
    }

    .header-title-group {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 16px;
      font-weight: 600;
      color: #f8fafc;
    }

    .active-pill-btn {
      background: transparent;
      color: #94a3b8;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 20px;
      padding: 6px 16px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }
    
    .active-pill-btn.selected {
      background: #0ea5e9; /* Light blue */
      color: white;
      border: none;
      box-shadow: 0 0 10px rgba(14, 165, 233, 0.4);
    }

    /* Override Shoelace Tab styling to hide native tabs since we're using custom header */
    sl-tab-group {
      --track-width: 0;
      --indicator-color: transparent;
    }
    
    sl-tab {
      display: none; /* Hide default tabs, we'll control it via state if needed, but keeping it simple for now */
    }

    /* ... */
  `;

  render(): unknown {
    return html`
      <div class="layout">
        ${this.renderSegmentsSidebar()}
        ${this.renderReelCenter()}
        ${this.renderToolsPanel()}
      </div>
    `;
  }

  /** Renders the left sidebar listing the Gemini-detected source segments (shorts). */
  private renderSegmentsSidebar(): unknown {
    return html`
      <aside class="glass-panel sidebar-left">
        <div class="panel-header">
          <sl-icon
            name="house-door-fill"
            class="home-button-icon"
            @click="${(): void => { Router.go('/'); }}"
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
                  <div class="segment-card" @click="${(): void => this.playShort(s)}">
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
    `;
  }

  /** Renders the center reel/preview area with the short-player component. */
  private renderReelCenter(): unknown {
    return html`
      <main class="reel-container" style="position: relative;">
        ${projectSignal.get()
        ? html`<short-player
                src="/api/projects/${projectSignal.get()?.id}/video"
                .subtitles=${this.currentShort?.subtitles || []}
                .subtitleStyle=${this.currentShort?.subtitleStyle}
                .startTime=${this.currentShort?.startTime || 0}
                .endTime=${this.currentShort?.endTime || 0}
                @edit-subtitle=${this.handleEditSubtitle}
                @style-changed=${this.handleStyleChange}
              ></short-player>`
        : html`<div>Loading project...</div>`
      }
      
      ${this.editingSubtitle ? html`
        <yts-subtitle-editor
          .subtitle=${this.editingSubtitle}
          .subtitleStyle=${this.currentShort?.subtitleStyle}
          @save-subtitle=${this.handleSaveSubtitle}
          @cancel-edit=${this.handleCancelEdit}
        ></yts-subtitle-editor>
      ` : ''}
      </main>
    `;
  }

  /** Renders the right tools panel (captions, style, audio tabs). */
  private renderToolsPanel(): unknown {
    return html`
      <aside class="glass-panel sidebar-right">
        <div class="tools-header">
          <div class="header-title-group">
            <sl-icon name="person-fill" style="color: #94a3b8; font-size: 18px;"></sl-icon>
            <span>Captions & Audio</span>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="active-pill-btn ${this.activeTab === 'style' ? 'selected' : 'unselected'}" @click=${() => this.activeTab = 'style'}>Style</button>
            <button class="active-pill-btn ${this.activeTab === 'audio' ? 'selected' : 'unselected'}" @click=${() => this.activeTab = 'audio'}>Audio</button>
          </div>
        </div>

        ${this.activeTab === 'style' ? html`
            ${this.currentShort ? html`
              <yts-subtitle-style-panel
                .shortId=${this.currentShort.id}
                .subtitleStyle=${this.currentShort.subtitleStyle || {}}
                @style-changed=${this.handleStyleChange}
                @apply-all-styles=${this.handleApplyAllStyles}
              ></yts-subtitle-style-panel>
            ` : html`
              <div style="color:#64748b; font-size:13px; text-align:center; padding:20px;">
                Select a short to edit styles
              </div>
            `}
        ` : ''}

        ${this.activeTab === 'audio' ? html`
            ${this.renderAudioPanel()}
        ` : ''}

        ${this.activeTab === 'captions' ? html`
            <div class="captions-list">
              ${[1, 2, 3, 4, 5].map(i => html`
                <div class="caption-item">
                  <sl-icon name="lock" style="color:#64748b; font-size: 14px;"></sl-icon>
                  <div class="caption-text">Caption line number ${i} text content...</div>
                  <div class="caption-time">00:${i * 5}</div>
                </div>
              `)}
            </div>
        ` : ''}
      </aside>
    `;
  }



  /** Renders the audio stem separation panel (state-driven: idle / separating / available). */
  private renderAudioPanel(): unknown {
    if (!this.currentShort) {
      return html`<div style="color:#64748b; font-size:13px; text-align:center; padding:20px;">Select a short first</div>`;
    }
    if (this.stemSeparating) {
      return html`
        <div style="text-align: center; padding: 20px 0;">
          <sl-spinner style="font-size: 2rem; --indicator-color: #818cf8;"></sl-spinner>
          <div style="margin-top: 12px; color: #94a3b8; font-size: 13px;">${this.stemMessage}</div>
          <div style="margin-top: 8px; background: rgba(99,102,241,0.2); border-radius: 8px; height: 6px; overflow: hidden;">
            <div style="height: 100%; background: #818cf8; border-radius: 8px; width: ${this.stemProgress}%; transition: width 0.3s;"></div>
          </div>
        </div>
      `;
    }
    if (this.stemAvailable) {
      return html`
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <sl-badge variant="success" style="align-self: flex-start;">Stems Ready</sl-badge>
          <div style="display: flex; gap: 8px; align-items: center;">
            <sl-icon name="mic" style="color: #818cf8;"></sl-icon>
            <span style="font-size: 13px; color: #e2e8f0;">Vocals</span>
            <audio controls style="flex: 1; height: 32px;">
              <source src="/api/projects/${projectSignal.get()?.id}/shorts/${this.currentShort.id}/stems/vocals" type="audio/wav">
            </audio>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <sl-icon name="music-note-beamed" style="color: #818cf8;"></sl-icon>
            <span style="font-size: 13px; color: #e2e8f0;">Music</span>
            <audio controls style="flex: 1; height: 32px;">
              <source src="/api/projects/${projectSignal.get()?.id}/shorts/${this.currentShort.id}/stems/accompaniment" type="audio/wav">
            </audio>
          </div>
          <sl-button variant="text" size="small" @click="${(): void => { void this.triggerStemSeparation(); }}">Re-run separation</sl-button>
        </div>
      `;
    }
    return html`
      <div style="text-align: center; padding: 20px 0;">
        <sl-icon name="soundwave" style="font-size: 2rem; color: #64748b;"></sl-icon>
        <p style="color: #94a3b8; font-size: 13px; margin: 12px 0;">Separate vocals from background music using AI.</p>
        <sl-button variant="primary" @click="${(): void => { void this.triggerStemSeparation(); }}">
          <sl-icon slot="prefix" name="mic"></sl-icon>
          Separate Audio Stems
        </sl-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'editor-page': EditorPage;
  }
}
