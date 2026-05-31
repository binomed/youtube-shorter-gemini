import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import { type BeforeEnterObserver, type RouterLocation } from '@vaadin/router';
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
import type { LayoutEvent, StemProgressEvent, ShortResponse, SubtitleResponse, VideoSegment } from '@youtube-shorter/shared';
import '../components/molecules/yts-dialog.element.ts';
import { ytsPremiumStyles } from '../styles/yts-styles.ts';
import '@shoelace-style/shoelace/dist/components/checkbox/checkbox.js';
import type { YtsShortPlayer } from '../components/organisms/yts-short-player.element.js';
import '../components/organisms/yts-short-player.element.js';

import '../components/molecules/yts-subtitle-editor.element.js';
import '../components/molecules/yts-subtitle-style-panel.element.js';
import '../components/molecules/yts-precision-multi-timeline.element.js';
import '../components/molecules/yts-header.element.js';
import { projectService } from '../services/project.service.js';
import { projectSignal, setProject, updateShortInProject, setShorts, addShortToProject } from '../state/project.state.js';
@customElement('editor-page')
export class EditorPage extends SignalWatcher(LitElement) implements BeforeEnterObserver {
  @state() private currentShort: ShortResponse | null = null;
  @state() private loading = true;
  @state() private creatingShort = false;
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

  @state() private currentTime = 0;
  @state() private isPlaying = false;

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

    const player = this.shadowRoot?.querySelector('yts-short-player') as unknown as { playSegment: (s: number, e: number) => void };
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
          if (projectId && this.currentShort) {
            const response = await fetch(`/api/projects/${projectId}/shorts/${this.currentShort.id}/subtitles/${subtitleId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text })
            });
            if (response.ok) {
              const updatedSub = await response.json();
              // Update with reconciled words from backend
              if (this.currentShort.subtitles) {
                this.currentShort.subtitles[subIndex] = updatedSub;
                this.currentShort = { ...this.currentShort }; 
                updateShortInProject(this.currentShort);
              }
            }
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

  private _styleSaveTimer?: number;

  private handleStyleChange(e: CustomEvent): void {
    const newStyle = e.detail.subtitleStyle;
    if (this.currentShort) {
      this.currentShort.subtitleStyle = newStyle;
      this.currentShort = { ...this.currentShort }; // Trigger Lit update
      updateShortInProject(this.currentShort);

      const projectId = projectSignal.get()?.id;
      const shortId = this.currentShort.id;
      
      if (!projectId || !shortId) return;

      if (this._styleSaveTimer) {
        window.clearTimeout(this._styleSaveTimer);
      }

      this._styleSaveTimer = window.setTimeout(async () => {
        try {
          await fetch(`/api/projects/${projectId}/shorts/${shortId}/style`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newStyle)
          });
        } catch (err) {
          console.error('Failed to save subtitle style:', err);
        }
      }, 500);
    }
  }

  private async handleApplyAllStyles(): Promise<void> {
    if (!this.currentShort || !this.currentShort.subtitleStyle) return;

    const projectId = projectSignal.get()?.id;
    if (!projectId) return;

    const styleToApply = this.currentShort.subtitleStyle;

    this.loading = true;
    try {
      const currentProject = projectSignal.get();
      if (!currentProject || !currentProject.shorts) return;

      const updatedShorts = await Promise.all(currentProject.shorts.map(async (short) => {
        // Skip current since it's already saved via style-changed event right before
        if (short.id === this.currentShort?.id) return short;

        const updated = { ...short, subtitleStyle: { ...styleToApply } };

        await fetch(`/api/projects/${projectId}/shorts/${short.id}/style`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(styleToApply)
        });
        
        return updated;
      }));

      setShorts(updatedShorts);
    } catch (err) {
      console.error('Failed to apply styles to all shorts:', err);
    } finally {
      this.loading = false;
    }
  }

  private async handleMarkDelta(e: CustomEvent): Promise<void> {
    const { boundary, delta } = e.detail;
    if (!this.currentShort) return;
    
    if (!this.currentShort.segments || this.currentShort.segments.length === 0) {
      this.currentShort.segments = [{
        startTime: this.currentShort.startTime,
        endTime: this.currentShort.endTime,
        layoutTimeline: []
      }];
    }

    const segment = { ...this.currentShort.segments[0] };
    if (boundary === 'in') {
      segment.startTime = Math.max(0, segment.startTime + delta);
    } else {
      segment.endTime = Math.max(segment.startTime + 0.1, segment.endTime + delta);
    }

    await this.saveSegments([segment]);

    // Restart video at new "In" point for verification
    const player = this.shadowRoot?.querySelector('yts-short-player') as HTMLElement & { seekTo: (time: number) => void };
    if (player && player.seekTo) {
      player.seekTo(segment.startTime);
    }
  }

  private async handleSegmentSettled(e: CustomEvent): Promise<void> {
    const segment = e.detail.segment;
    await this.saveSegments([segment]);

    // Wait for Lit to process property updates (currentShort, segments)
    // before asking the player to seek, to avoid jump-cuts triggered by old bounds.
    await this.updateComplete;

    // Restart video at the beginning of the segment
    const player = this.shadowRoot?.querySelector('yts-short-player') as HTMLElement & { seekTo: (time: number) => void };
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
          updateShortInProject(updatedShort);
          this.requestUpdate();
        }
      }
    } catch (err) {
      console.error('Failed to save segments:', err);
    }
  }

  async handleLayoutChange(e: CustomEvent): Promise<void> {
    const { layoutMode, timestamp } = e.detail;
    console.log('[EditorPage] handleLayoutChange', { layoutMode, timestamp });

    if (!this.currentShort) return;

    if (!this.currentShort.segments || this.currentShort.segments.length === 0) {
      this.currentShort.segments = [{
        startTime: this.currentShort.startTime,
        endTime: this.currentShort.endTime,
        layoutTimeline: []
      }];
    }

    const segments = JSON.parse(JSON.stringify(this.currentShort.segments));
    const seg = segments[0];
    if (!seg.layoutTimeline) seg.layoutTimeline = [];

    // Find if a keyframe exists exactly at this timestamp
    const existingIndex = seg.layoutTimeline.findIndex((ev: LayoutEvent) => Math.abs(ev.timestamp - timestamp) < 0.1);

    if (existingIndex > -1) {
      console.log('[EditorPage] Updating existing keyframe layoutMode');
      seg.layoutTimeline[existingIndex].layoutMode = layoutMode;
    } else {
      console.log('[EditorPage] Adding new keyframe via layout toggle');
      const player = this.shadowRoot?.querySelector('yts-short-player') as YtsShortPlayer;
      const currentLayout = player?.getCurrentLayout() || { centerX: 0.5 };
      
      seg.layoutTimeline.push({
        timestamp,
        layoutMode,
        centerX: currentLayout.centerX
      });
      seg.layoutTimeline.sort((a: LayoutEvent, b: LayoutEvent) => a.timestamp - b.timestamp);
    }

    await this.saveSegments(segments);
  }

  async handlePanChange(e: CustomEvent): Promise<void> {
    const { centerX, timestamp } = e.detail;
    console.log('[EditorPage] handlePanChange', { centerX, timestamp });
    
    if (!this.currentShort) return;
    
    if (!this.currentShort.segments || this.currentShort.segments.length === 0) {
      this.currentShort.segments = [{
        startTime: this.currentShort.startTime,
        endTime: this.currentShort.endTime,
        layoutTimeline: []
      }];
    }

    const segments = JSON.parse(JSON.stringify(this.currentShort.segments));
    const seg = segments[0];
    if (!seg.layoutTimeline) seg.layoutTimeline = [];

    // Find if a keyframe exists exactly at this timestamp
    const existingIndex = seg.layoutTimeline.findIndex((ev: LayoutEvent) => Math.abs(ev.timestamp - timestamp) < 0.1);

    if (existingIndex > -1) {
      console.log('[EditorPage] Updating existing keyframe centerX');
      seg.layoutTimeline[existingIndex].centerX = centerX;
    } else {
      console.log('[EditorPage] Adding new keyframe via pan change');
      const player = this.shadowRoot?.querySelector('yts-short-player') as YtsShortPlayer;
      const currentLayout = player?.getCurrentLayout() || { layoutMode: 'fill' };

      seg.layoutTimeline.push({
        timestamp,
        layoutMode: currentLayout.layoutMode,
        centerX
      });
      seg.layoutTimeline.sort((a: LayoutEvent, b: LayoutEvent) => a.timestamp - b.timestamp);
    }
    
    await this.saveSegments(segments);
  }

  async handleToggleKeyframe(e: CustomEvent): Promise<void> {
    const { timestamp } = e.detail;
    console.log('[EditorPage] handleToggleKeyframe', { timestamp });
    if (!this.currentShort) return;

    if (!this.currentShort.segments || this.currentShort.segments.length === 0) {
      console.log('[EditorPage] Initializing default segment for keyframe toggle');
      this.currentShort.segments = [{
        startTime: this.currentShort.startTime,
        endTime: this.currentShort.endTime,
        layoutTimeline: []
      }];
    }

    const segments = JSON.parse(JSON.stringify(this.currentShort.segments));
    const seg = segments[0];
    if (!seg.layoutTimeline) seg.layoutTimeline = [];

    const existingIndex = seg.layoutTimeline.findIndex((ev: LayoutEvent) => Math.abs(ev.timestamp - timestamp) < 0.1);
    const intent = e.detail.intent || (existingIndex > -1 ? 'remove' : 'add');

    console.log('[EditorPage] Processed intent:', intent);

    if (intent === 'remove') {
      let indexToRemove = existingIndex;
      if (indexToRemove === -1) {
        // If no exact match but we want to remove, remove the active one (preceding or at timestamp)
        indexToRemove = -1;
        for (let i = seg.layoutTimeline.length - 1; i >= 0; i--) {
          if (seg.layoutTimeline[i].timestamp <= timestamp) {
            indexToRemove = i;
            break;
          }
        }
      }

      if (indexToRemove > -1) {
        console.log('[EditorPage] Removing keyframe at index', indexToRemove);
        seg.layoutTimeline.splice(indexToRemove, 1);
      }
    } else {
      // Intent: Add (only if doesn't exist)
      if (existingIndex === -1) {
        const player = this.shadowRoot?.querySelector('yts-short-player') as YtsShortPlayer;
        const layout = player?.getCurrentLayout() || { layoutMode: 'fill', centerX: 0.5 };

        console.log('[EditorPage] Adding new keyframe', { timestamp, layout });
        seg.layoutTimeline.push({
          timestamp,
          layoutMode: layout.layoutMode,
          centerX: layout.centerX
        });

        // Sort timeline
        seg.layoutTimeline.sort((a: LayoutEvent, b: LayoutEvent) => a.timestamp - b.timestamp);
      }
    }

    await this.saveSegments(segments);
  }

  private handleTogglePlay(): void {
    const player = this.shadowRoot?.querySelector('yts-short-player') as YtsShortPlayer;
    if (player && typeof player.togglePlay === 'function') {
      player.togglePlay();
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

    let jobId: string;
    try {
      const response = await fetch(
        `/api/projects/${projectId}/shorts/${shortId}/stems`,
        { method: 'POST' }
      );
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || 'Failed to start stem separation');
      }
      jobId = result.jobId;
    } catch (e) {
      console.error('Stem separation request failed:', e);
      this.stemMessage = 'Failed to start stem separation.';
      this.stemSeparating = false;
      return;
    }

    // Connect SSE for progress using the jobId
    const eventSource = new EventSource(
      `/api/projects/${projectId}/shorts/${shortId}/stems/progress?jobId=${jobId}`
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
        this.stemMessage = data.message || 'Separation failed.';
        eventSource.close();
      }
    });

    eventSource.onerror = (): void => {
      if (this.stemSeparating) {
        this.stemMessage = 'Lost connection to separation server.';
        this.stemSeparating = false;
      }
      eventSource.close();
    };
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

    let jobId: string;
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
        throw new Error(result.message || 'Failed to start export');
      }
      jobId = result.jobId;
    } catch (e) {
      console.error('Export request failed:', e);
      this.exportMessage = 'Export failed to start.';
      this.exporting = false;
      alert('Failed to start export');
      return;
    }

    const eventSource = new EventSource(
      `/api/projects/${projectId}/shorts/${shortId}/export/progress?jobId=${jobId}`
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

    eventSource.onerror = (): void => {
      if (this.exporting) {
        this.exportMessage = 'Lost connection to export server.';
        this.exporting = false;
      }
      eventSource.close();
    };
  }

  private async loadShorts(): Promise<void> {
    const projectId = projectSignal.get()?.id;
    if (!projectId) {
      this.loading = false;
      return;
    }
    try {
      const shorts = await projectService.getShorts(projectId);
      setShorts(shorts);
      if (shorts.length > 0 && !this.currentShort) {
        this.playShort(shorts[0]);
      }
    } catch (e) {
      console.error('Failed to load shorts:', e);
    }
    this.loading = false;
  }

  private async handleAddCustomShort(): Promise<void> {
    const project = projectSignal.get();
    if (!project || this.creatingShort) return;

    this.creatingShort = true;
    try {
      const newShort = await projectService.createShort(project.id);
      addShortToProject(newShort);
      this.playShort(newShort);
    } catch (err) {
      console.error('Failed to create custom short:', err);
    } finally {
      this.creatingShort = false;
    }
  }

  /**
   * Format seconds to MM:SS display
   */
  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }
  static styles = [
    ytsPremiumStyles,
    css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      background: radial-gradient(circle at 50% 50%, #232334 0%, #111116 100%);
      color: #e2e8f0;
      font-family: 'Inter', sans-serif;
      overflow: hidden;
    }


    .layout {
      display: grid;
      grid-template-columns: 280px 1fr 340px;
      flex: 1;
      height: calc(100vh - 64px);
      gap: 24px;
      padding: 0 24px 24px 24px;
      box-sizing: border-box;
      overflow: hidden;
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
      display: flex;
      flex-direction: column;
      overflow: hidden;
      padding: 20px;
    }

    .segment-list::-webkit-scrollbar {
      width: 6px;
    }

    .segment-list::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.02);
    }

    .segment-list::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
    }

    .segment-list::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .segment-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
      overflow-y: auto;
      flex: 1;
      padding-right: 4px; /* Space for scrollbar */
    }

    .segment-card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 0;
      margin: 0;
      overflow: hidden;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      color: inherit;
      transition: all 0.2s ease;
      position: relative;
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .segment-card:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .segment-card.selected {
      background: rgba(14, 165, 233, 0.1);
      border-color: #0ea5e9;
      box-shadow: 0 0 15px rgba(14, 165, 233, 0.2);
    }

    .segment-thumb {
      width: 100%;
      aspect-ratio: 16/9;
      position: relative;
      background: #000;
    }

    .thumb-overlay {
      position: absolute;
      bottom: 8px;
      left: 8px;
      right: 8px;
      display: flex;
      justify-content: space-between;
      pointer-events: none;
    }

    .overlay-pill {
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .segment-footer {
      padding: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .segment-title {
      font-size: 13px;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex: 1;
    }

    .selected-check {
      color: #0ea5e9;
      font-size: 16px;
      display: none;
    }

    .segment-card.selected .selected-check {
      display: block;
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
      flex: 1;
      overflow-y: auto;
      min-height: 0;
      padding-right: 4px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .captions-list::-webkit-scrollbar {
      width: 6px;
    }

    .captions-list::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.02);
    }

    .captions-list::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
    }

    .captions-list::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.15);
    }

    .caption-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      padding: 10px;
      cursor: pointer;
      display: flex;
      width: 100%;
      gap: 10px;
      align-items: flex-start;
      transition: all 0.2s ease;
      text-align: left;
      font-family: inherit;
      color: inherit;
    }

    .caption-item:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.1);
        transform: translateX(2px);
    }

    .tools-content {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding-right: 4px;
    }

    .tools-content::-webkit-scrollbar {
      width: 6px;
    }

    .tools-content::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.02);
    }

    .tools-content::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
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
    .sidebar-right {
      background: #1e202a;
      border: 1px solid rgba(255,255,255,0.05);
      box-shadow: none;
      padding: 16px;
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    }

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


    .export-btn {
      background: linear-gradient(90deg, #0ea5e9 0%, #a855f7 100%);
      border: none;
      color: white;
      padding: 8px 18px;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(14, 165, 233, 0.3);
      text-decoration: none;
      outline: none;
    }

    .export-btn:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(168, 85, 247, 0.4);
      filter: brightness(1.1);
    }

    .export-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .export-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      filter: grayscale(0.5);
    }

    .add-segment-card {
      background: rgba(255, 255, 255, 0.02);
      border: 2px dashed rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      padding: 20px;
      margin: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      text-align: center;
      color: #94a3b8;
      width: 100%;
      box-sizing: border-box;
      font-family: inherit;
    }

    .add-segment-card:hover:not(:disabled) {
      background: rgba(14, 165, 233, 0.05);
      border-color: #0ea5e9;
      color: #f8fafc;
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(14, 165, 233, 0.15);
    }

    .add-segment-card:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .add-segment-card:focus-visible {
      outline: 2px solid #0ea5e9;
      outline-offset: 2px;
    }

    .add-icon-container {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.05);
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
      font-size: 20px;
      color: #94a3b8;
    }

    .add-segment-card:hover:not(:disabled) .add-icon-container {
      background: #0ea5e9;
      border-color: #0ea5e9;
      color: white;
      transform: scale(1.1);
      box-shadow: 0 0 12px rgba(14, 165, 233, 0.5);
    }
    
    .add-text {
      font-size: 13px;
      font-weight: 600;
      letter-spacing: -0.01em;
    }
  `];

  render(): unknown {
    return html`
      <yts-header>
        <button slot="actions" class="export-btn" ?disabled=${!this.currentShort} @click=${this.openExportDialog}>
          <sl-icon name="download"></sl-icon> Export
        </button>
      </yts-header>
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
       <yts-dialog 
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
       </yts-dialog>
     `;
  }

  /** Renders the left sidebar listing the Gemini-detected source segments (shorts). */
  private renderSegmentsSidebar(): unknown {
    return html`
      <aside class="glass-panel sidebar-left">
        <div class="panel-header">
          <sl-icon name="collection-play-fill" style="color: #94a3b8; font-size: 18px;"></sl-icon>
          <span>Source Segments</span>
        </div>
        <div class="segment-list">
          ${this.loading
        ? html`<div style="color:#64748b; text-align:center; padding:20px;">Loading shorts...</div>`
        : (projectSignal.get()?.shorts || []).length === 0
          ? html`<div style="color:#64748b; text-align:center; padding:20px;">No shorts detected yet.</div>`
          : (projectSignal.get()?.shorts || []).map(s => {
            const isSelected = this.currentShort?.id === s.id;
            return html`
                <button 
                    class="segment-card ${isSelected ? 'selected' : ''}" 
                    @click="${(): void => this.playShort(s)}"
                    aria-label="Play segment ${s.title}"
                >
                  <div class="segment-thumb">
                    ${s.thumbnailUrl
                ? html`<img src="${s.thumbnailUrl}" alt="${s.title}" style="width:100%; height:100%; object-fit:cover;">`
                : ''
              }
                    <div class="thumb-overlay">
                      <div class="overlay-pill">16:9</div>
                      <div class="overlay-pill">${this.formatTime(s.endTime - s.startTime)}</div>
                    </div>
                  </div>
                  <div class="segment-footer">
                    <span class="segment-title">${s.title}</span>
                    <sl-icon name="check-circle-fill" class="selected-check"></sl-icon>
                  </div>
                </button>
              `;
          })}
          
          ${!this.loading ? html`
            <button 
                class="add-segment-card" 
                @click="${this.handleAddCustomShort}"
                ?disabled="${this.creatingShort}"
                aria-label="Add a custom short"
            >
              <div class="add-icon-container">
                ${this.creatingShort 
                  ? html`<sl-spinner style="--indicator-color: #0ea5e9; font-size: 1.2rem;"></sl-spinner>` 
                  : html`<sl-icon name="plus" style="font-weight: bold;"></sl-icon>`
                }
              </div>
              <span class="add-text">${this.creatingShort ? 'Creating...' : 'Add Short'}</span>
            </button>
          ` : ''}
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
                <yts-short-player
                  style="width: 100%; height: 100%;"
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
                   @layout-changed=${(e: CustomEvent): void => { console.log('[Editor] Layout change', e.detail); void this.handleLayoutChange(e); }}
                   @pan-changed=${(e: CustomEvent): void => { console.log('[Editor] pan', e.detail); void this.handlePanChange(e); }}
                   @toggle-keyframe=${(e: CustomEvent): void => { console.log('[Editor] keyframe', e.detail); void this.handleToggleKeyframe(e); }}
                   @time-update=${(e: CustomEvent) => (this.currentTime = e.detail.currentTime)}
                   @playback-status-changed=${(e: CustomEvent) => (this.isPlaying = e.detail.isPlaying)}
                  ></yts-short-player>
              </div>

              ${this.currentShort ? html`
                  <yts-precision-multi-timeline
                      style="flex-shrink: 0; width: 100%; max-width: 800px; padding-bottom: 24px;"
                      .duration=${projectSignal.get()?.duration || 0}
                      .fps=${projectSignal.get()?.framerate || 30}
                      .currentTime=${this.currentTime}
                      .isPlaying=${this.isPlaying}
                      .segment=${this.currentShort.segments?.[0] || { startTime: this.currentShort.startTime, endTime: this.currentShort.endTime }}
                      @segment-settled=${this.handleSegmentSettled}
                      @timeline-seek=${(e: CustomEvent) => {
              const player = this.shadowRoot?.querySelector('yts-short-player') as YtsShortPlayer;
              if (player) player.seekTo(e.detail.time);
            }}
                      @toggle-play=${() => this.handleTogglePlay()}
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
          <div class="header-title-group">
            <sl-icon name="chat-square-text-fill" style="color: #94a3b8; font-size: 18px;"></sl-icon>
            <span>Captions & Audio</span>
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
              class="tools-content"
              .shortId=${this.currentShort.id}
              .subtitleStyle=${this.currentShort.subtitleStyle || {}}
              @style-changed=${this.handleStyleChange}
              @apply-all-styles=${this.handleApplyAllStyles}
            ></yts-subtitle-style-panel>
          ` : html`
            <div class="tools-content" style="color:#64748b; font-size:13px; text-align:center; padding:20px;">
              Select a short to edit styles
            </div>
          `}
      ` : ''}

      ${this.activeTab === 'audio' ? html`
          <div class="tools-content">
            ${this.renderAudioPanel()}
          </div>
      ` : ''}

        ${this.activeTab === 'captions' ? html`
            <div class="captions-list tools-content">
              ${!this.currentShort?.subtitles || this.currentShort.subtitles.length === 0
          ? html`<div style="color:#64748b; font-size:13px; text-align:center; padding:20px;">No captions found. Move boundaries or wait for transcription.</div>`
          : this.currentShort.subtitles.map(sub => html`
                  <button 
                      class="caption-item" 
                      @click=${() => this.handleEditSubtitle(new CustomEvent('edit-subtitle', { detail: { subtitle: sub } }))}
                      aria-label="Edit caption: ${sub.text}"
                  >
                    <sl-icon name="chat-square-text" style="color:#818cf8; font-size: 14px;"></sl-icon>
                    <div class="caption-text">${sub.text}</div>
                    <div class="caption-time">${this.formatTime(sub.startTime)}</div>
                  </button>
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
