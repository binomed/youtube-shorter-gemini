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
import '@shoelace-style/shoelace/dist/components/dialog/dialog.js';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import '../components/short-player.js';
import '../components/molecules/yts-subtitle-editor.element.js';
import '../components/molecules/yts-subtitle-style-panel.element.js';
import '../components/molecules/yts-precision-multi-timeline.element.js';
import { projectService } from '../services/project.service.js';
import { projectSignal, setProject } from '../state/project.state.js';
import type { ShortResponse, StemProgressEvent, SubtitleResponse, VideoSegment } from '@youtube-shorter/shared';

@customElement('editor-page')
export class EditorPage extends SignalWatcher(LitElement) implements BeforeEnterObserver {
  @state() private shorts: ShortResponse[] = [];
  @state() private currentShort: ShortResponse | null = null;
  @state() private loading = true;
  @state() private stemSeparating = false;
  @state() private stemProgress = 0;
  @state() private stemMessage = '';
  @state() private stemAvailable = false;
  @state() private stemTimestamp = Date.now();
  @state() private editingSubtitle: SubtitleResponse | null = null;
  @state() private activeTab: 'captions' | 'style' | 'audio' = 'style';

  // Export State
  @state() private showExportDialog = false;
  @state() private exporting = false;
  @state() private exportProgress = 0;
  @state() private exportMessage = '';
  @state() private exportIncludeVocals = true;
  @state() private exportIncludeMusic = true;

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

  private async handleMarkDelta(e: CustomEvent): Promise<void> {
    const { boundary, delta } = e.detail;
    if (!this.currentShort || !this.currentShort.segments || this.currentShort.segments.length === 0) return;

    const segment = { ...this.currentShort.segments[0] };
    if (boundary === 'in') {
      segment.startTime = Math.max(0, segment.startTime + delta);
    } else {
      segment.endTime = Math.max(segment.startTime + 0.1, segment.endTime + delta);
    }

    await this.saveSegments([segment]);

    // Redémarrer la vidéo au nouveau point "In" pour vérification
    const player = this.shadowRoot?.querySelector('short-player') as HTMLElement & { seekTo: (time: number) => void };
    if (player && player.seekTo) {
      player.seekTo(segment.startTime);
    }
  }

  private async handleSegmentSettled(e: CustomEvent): Promise<void> {
    const segment = e.detail.segment;
    await this.saveSegments([segment]);

    // Redémarrer la vidéo au début du segment
    const player = this.shadowRoot?.querySelector('short-player') as HTMLElement & { seekTo: (time: number) => void };
    if (player && player.seekTo) {
      player.seekTo(segment.startTime);
    }
  }

  private async saveSegments(segments: VideoSegment[]): Promise<void> {
    if (!this.currentShort) return;

    // Optimistic update
    this.currentShort.segments = segments;
    this.currentShort = { ...this.currentShort };
    this.stemAvailable = false; // Invalidate stems in UI immediately

    try {
      const projectId = projectSignal.get()?.id;
      if (projectId) {
        const response = await fetch(`/api/projects/${projectId}/shorts/${this.currentShort.id}/segments`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ segments })
        });
        if (response.ok) {
          const updatedShort = await response.json();
          this.currentShort = updatedShort;
          this.stemAvailable = updatedShort.stemsAvailable ?? false;

          // Update projectSignal to refresh the left sidebar timings
          const currentProject = projectSignal.get();
          if (currentProject && currentProject.shorts) {
            const updatedShorts = currentProject.shorts.map(s => s.id === updatedShort.id ? updatedShort : s);
            projectSignal.set({ ...currentProject, shorts: updatedShorts });
          }
          this.requestUpdate();
        }
      }
    } catch (err) {
      console.error('Failed to save segments:', err);
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
        this.stemTimestamp = Date.now();
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
        this.stemTimestamp = Date.now();
      }
    } catch (e) {
      console.error('Stem separation failed:', e);
      this.stemMessage = 'Stem separation failed.';
    } finally {
      this.stemSeparating = false;
      eventSource.close();
    }
  }

  // ==== EXPORT LOGIC ====
  private openExportDialog(): void {
    if (!this.currentShort) return;
    this.exportIncludeVocals = true;
    this.exportIncludeMusic = true;
    this.showExportDialog = true;
  }

  private closeExportDialog(): void {
    if (this.exporting) return;
    this.showExportDialog = false;
  }

  private async startExport(): Promise<void> {
    const projectId = projectSignal.get()?.id;
    const shortId = this.currentShort?.id;
    if (!projectId || !shortId) return;

    this.exporting = true;
    this.exportProgress = 0;
    this.exportMessage = 'Starting export...';

    const eventSource = new EventSource(
      `/api/projects/${projectId}/shorts/${shortId}/export/progress`
    );

    eventSource.addEventListener('export-progress', (event: Event): void => {
      const data = JSON.parse((event as MessageEvent).data);
      this.exportProgress = data.progress;
      this.exportMessage = data.message;

      if (data.phase === 'complete') {
        this.exporting = false;
        eventSource.close();

        // Trigger download
        if (data.exportUrl) {
          const a = document.createElement('a');
          a.href = data.exportUrl;
          a.download = '';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }

        // Wait briefly for download to start then close
        setTimeout(() => {
          this.showExportDialog = false;
        }, 1500);

      } else if (data.phase === 'error') {
        this.exporting = false;
        eventSource.close();
        alert('Export failed: ' + data.message);
      }
    });

    try {
      const response = await fetch(`/api/projects/${projectId}/shorts/${shortId}/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shortId,
          includeVocals: this.exportIncludeVocals,
          includeMusic: this.exportIncludeMusic,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message);
      }
    } catch (e) {
      console.error('Export request failed:', e);
      this.exportMessage = 'Export failed to start.';
      this.exporting = false;
      eventSource.close();
      alert('Failed to start export');
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
      if (this.shorts.length > 0 && !this.currentShort) {
        this.playShort(this.shorts[0]);
      }
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
    }

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
      background: #1e202a;
      border: 1px solid rgba(255,255,255,0.05);
      box-shadow: none;
      padding: 16px;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0; /* Allow content to shrink */
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

    .captions-list {
      flex: 1; /* Allow captions list to take available space */
      overflow-y: auto; /* Enable scrolling for captions */
      padding-right: 4px; /* Space for scrollbar */
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .captions-list::-webkit-scrollbar {
      width: 4px;
    }

    .captions-list::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
    }

    .captions-list::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
    }

    .caption-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      display: flex;
      gap: 10px;
      align-items: flex-start;
      transition: all 0.2s ease;
    }

    .caption-item:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.1);
        transform: translateX(2px);
    }

    .caption-text {
        flex: 1;
        font-size: 13px;
        color: #f1f5f9;
        line-height: 1.4;
    }

    .caption-time {
        font-size: 11px;
        color: #64748b;
        font-family: monospace;
        margin-top: 2px;
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
      display: none;
    }

    .reel-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      justify-content: center;
      align-items: center;
    }

    .layout {
      display: grid;
      grid-template-columns: 280px 1fr 340px;
      height: 100vh;
      max-height: 100vh;
      gap: 24px;
      padding: 24px;
      box-sizing: border-box;
      overflow: hidden;
    }

    .dialog-overview::part(panel) {
      background-color: var(--yts-bg-secondary, #12121a);
      border: 1px solid var(--yts-glass-border, rgba(99, 102, 241, 0.5));
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
    }

    .dialog-overview::part(overlay) {
      backdrop-filter: blur(8px);
    }
  `;

  render(): unknown {
    return html`
      <div class="layout">
        ${this.renderSegmentsSidebar()}
        ${this.renderReelCenter()}
        ${this.renderToolsPanel()}
      </div>
      ${this.renderExportDialog()}
    `;
  }

  private renderExportDialog(): unknown {
    return html`
       <sl-dialog 
         hoist
         label="Export Short" 
         class="dialog-overview" 
         style="--sl-z-index-dialog: 9999; z-index: 9999;"
         ?open=${this.showExportDialog}
         @sl-request-close=${(e: CustomEvent) => {
        if (this.exporting) e.preventDefault();
        else this.closeExportDialog();
      }}
       >
         ${this.exporting ? html`
            <div style="text-align: center; padding: 20px 0;">
              <sl-spinner style="font-size: 2rem; --indicator-color: #818cf8;"></sl-spinner>
              <div style="margin-top: 12px; color: #94a3b8; font-size: 13px;">${this.exportMessage}</div>
              <div style="margin-top: 8px; background: rgba(99,102,241,0.2); border-radius: 8px; height: 6px; overflow: hidden;">
                <div style="height: 100%; background: #818cf8; border-radius: 8px; width: ${this.exportProgress}%; transition: width 0.3s;"></div>
              </div>
            </div>
         ` : html`
            <div style="display: flex; flex-direction: column; gap: 16px;">
               <p style="color: #e2e8f0; font-size: 14px; margin: 0;">Configure your export settings for this Short. Re-rendering will burn in your subtitle styles.</p>
               
               ${this.stemAvailable ? html`
                 <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; display: flex; flex-direction: column; gap: 12px;">
                    <strong style="color: #f8fafc; font-size: 14px;">Audio Options (Stems detected)</strong>
                    <sl-checkbox ?checked=${this.exportIncludeVocals} @click=${() => this.exportIncludeVocals = !this.exportIncludeVocals}>Include Vocals Track</sl-checkbox>
                    <sl-checkbox ?checked=${this.exportIncludeMusic} @click=${() => this.exportIncludeMusic = !this.exportIncludeMusic}>Include Music & Accompaniment</sl-checkbox>
                 </div>
               ` : html`
                 <div style="background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px;">
                    <span style="color: #94a3b8; font-size: 13px;">Default video audio will be used. Run Stem Separation first to control vocal levels.</span>
                 </div>
               `}
            </div>
         `}
         
         <sl-button slot="footer" variant="default" @click=${this.closeExportDialog} ?disabled=${this.exporting}>Cancel</sl-button>
         <sl-button slot="footer" variant="primary" @click=${this.startExport} ?disabled=${this.exporting}>
            ${this.exporting ? 'Exporting...' : 'Start Export'}
         </sl-button>
       </sl-dialog>
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
          `)}
        </div>
      </aside>
    `;
  }

  /** Renders the center reel/preview area with the short-player component. */
  private renderReelCenter(): unknown {
    const projectId = projectSignal.get()?.id;
    return html`
      <main class="reel-container" style="position: relative;">
        ${projectId
        ? html`
            <div style="display: flex; flex-direction: column; gap: 16px; height: 100%; width: 100%; overflow: hidden; justify-content: space-between; align-items: center; padding: 0 12px;">
              <div style="flex: 1; min-height: 0; width: 100%; display: flex; justify-content: center; align-items: center;">
                <short-player
                  style="max-height: 100%; max-width: 100%; width: auto; height: auto;"
                  src="/api/projects/${projectId}/video"
                  .subtitles=${this._getFilteredSubtitles()}
                  .subtitleStyle=${this.currentShort?.subtitleStyle}
                  .startTime=${this.currentShort?.startTime || 0}
                  .endTime=${this.currentShort?.endTime || 0}
                  .segments=${this.currentShort?.segments || []}
                  @edit-subtitle=${this.handleEditSubtitle}
                  @style-changed=${this.handleStyleChange}
                  @mark-delta=${this.handleMarkDelta}
                  @segment-settled=${this.handleSegmentSettled}
                  ></short-player>
              </div>

              ${this.currentShort ? html`
                  <yts-precision-multi-timeline
                      style="flex-shrink: 0; width: 100%; max-width: 800px; padding-bottom: 24px;"
                      .duration=${projectSignal.get()?.duration || 0}
                      .segment=${this.currentShort.segments?.[0] || { startTime: this.currentShort.startTime, endTime: this.currentShort.endTime }}
                      @segment-settled=${this.handleSegmentSettled}
                  ></yts-precision-multi-timeline>
              ` : ''}
            </div>`
        : html`<div>Loading project...</div>`
      }

      ${this.editingSubtitle ? html`
        <yts-subtitle-editor
          .subtitle=${this.editingSubtitle}
          .subtitleStyle=${this.currentShort?.subtitleStyle}
          @save-subtitle=${this.handleSaveSubtitle}
          @cancel-edit=${this.handleCancelEdit}
        ></yts-subtitle-editor>
      ` : ''
      }
</main>
  `;
  }

  private _getFilteredSubtitles(): SubtitleResponse[] {
    if (!this.currentShort) return [];
    const segments = this.currentShort.segments;
    if (!segments || segments.length === 0) {
      // Fallback to original detection if no manual segments
      const start = this.currentShort.startTime;
      const end = this.currentShort.endTime;
      return (this.currentShort.subtitles || []).filter(sub => sub.startTime >= start && sub.endTime <= end);
    }

    const seg = segments[0];
    return (this.currentShort.subtitles || []).filter(sub =>
      sub.startTime <= seg.endTime && sub.endTime >= seg.startTime
    );
  }

  /** Renders the right tools panel (captions, style, audio tabs). */
  private renderToolsPanel(): unknown {
    return html`
      <aside class="glass-panel sidebar-right">
        <div class="tools-header">
          <div class="header-title-group" style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 8px;">
               <sl-icon name="person-fill" style="color: #94a3b8; font-size: 18px;"></sl-icon>
               <span>Captions & Audio</span>
            </div>
            <sl-button variant="primary" size="small" ?disabled=${!this.currentShort} @click=${this.openExportDialog}>
              <sl-icon slot="prefix" name="download"></sl-icon> Export
            </sl-button>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="active-pill-btn ${this.activeTab === 'captions' ? 'selected' : 'unselected'}" @click=${() => this.activeTab = 'captions'}>Captions</button>
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
              ${!this.currentShort?.subtitles || this.currentShort.subtitles.length === 0
          ? html`<div style="color:#64748b; font-size:13px; text-align:center; padding:20px;">No captions found. Move boundaries or wait for transcription.</div>`
          : this.currentShort.subtitles.map(sub => html`
                    <div class="caption-item" @click=${() => this.handleEditSubtitle(new CustomEvent('edit-subtitle', { detail: { subtitle: sub } }))}>
                      <sl-icon name="chat-square-text" style="color:#818cf8; font-size: 14px;"></sl-icon>
                      <div class="caption-text">${sub.text}</div>
                      <div class="caption-time">${this.formatTime(sub.startTime)}</div>
                    </div>
                  `)
        }
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
      const projectId = projectSignal.get()?.id;
      return html`
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <sl-badge variant="success" style="align-self: flex-start;">Stems Ready</sl-badge>
          <div style="display: flex; gap: 8px; align-items: center;">
            <sl-icon name="mic" style="color: #818cf8;"></sl-icon>
            <span style="font-size: 13px; color: #e2e8f0;">Vocals</span>
            <audio controls style="flex: 1; height: 32px;" 
                   src="/api/projects/${projectId}/shorts/${this.currentShort.id}/stems/vocals?t=${this.stemTimestamp}">
            </audio>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <sl-icon name="music-note-beamed" style="color: #818cf8;"></sl-icon>
            <span style="font-size: 13px; color: #e2e8f0;">Music</span>
            <audio controls style="flex: 1; height: 32px;"
                   src="/api/projects/${projectId}/shorts/${this.currentShort.id}/stems/accompaniment?t=${this.stemTimestamp}">
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
