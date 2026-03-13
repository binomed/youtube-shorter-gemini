/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import type { SubtitleResponse, SubtitleStyle, VideoSegment } from '@youtube-shorter/shared';
import '../molecules/yts-subtitle-overlay.element.js';

/**
 * Component for playing and editing short-form videos.
 *
 * Features:
 * - Displays video preview with overlay controls
 * - Editable floating caption
 * - Play/Pause functionality
 * - Used in the Editor Page for final adjustments
 *
 * @element yts-short-player
 */
@customElement('yts-short-player')
export class YtsShortPlayer extends LitElement {
  @property({ type: String }) src = '';
  @property({ type: String }) caption = '';
  @property({ type: Array }) subtitles: SubtitleResponse[] = [];
  @property({ type: Object }) subtitleStyle?: SubtitleStyle;
  @property({ type: Number }) startTime = 0;
  @property({ type: Number }) endTime = 0;
  @property({ type: Array }) segments: VideoSegment[] = [];

  @query('#main-video') videoElement!: HTMLVideoElement;
  @query('.video-background') bgVideoElement!: HTMLVideoElement;
  @state() private isPlaying = false;
  @state() private currentTime = 0;
  @state() private duration = 0;
  private _rafId = 0;

  private get _activeSegment(): VideoSegment | null {
    if (this.segments && this.segments.length > 0) {
      return this.segments[0];
    }
    return null;
  }

  public getCurrentLayout(): { layoutMode: 'fill' | 'fullscreen', centerX: number } {
    const seg = this._activeSegment;
    if (!seg) return { layoutMode: 'fill', centerX: 0.5 };

    // Default values from segment root
    let mode: 'fill' | 'fullscreen' = seg.layoutMode || 'fill';
    let center = seg.centerX ?? 0.5;

    // Search in timeline
    if (seg.layoutTimeline && seg.layoutTimeline.length > 0) {
      // Find the last event that started at or before the current time
      const sortedEvents = [...seg.layoutTimeline].sort((a, b) => a.timestamp - b.timestamp);
      const activeEvent = [...sortedEvents].reverse().find(ev => ev.timestamp <= this.currentTime);

      if (activeEvent) {
        mode = activeEvent.layoutMode;
        center = activeEvent.centerX;
      }
      // If no activeEvent (before first keyframe), it naturally falls back to root mode/center set above
    }

    return { layoutMode: mode, centerX: center };
  }

  private get _currentLayoutMode(): 'fill' | 'fullscreen' {
    return this.getCurrentLayout().layoutMode;
  }

  private get _currentCenterX(): number {
    return this.getCurrentLayout().centerX;
  }

  public togglePlay(): void {
    if (!this.videoElement) return;
    if (this.videoElement.paused) {
      void this.videoElement.play();
      if (this.bgVideoElement) void this.bgVideoElement.play().catch(() => { });
      this.isPlaying = true;
    } else {
      this.videoElement.pause();
      if (this.bgVideoElement) this.bgVideoElement.pause();
      this.isPlaying = false;
    }
    this._dispatchPlaybackStatus();
    
    if (this.isPlaying) {
      this._startRafLoop();
    } else {
      this._stopRafLoop();
    }
  }

  private _startRafLoop() {
    this._stopRafLoop();
    const loop = () => {
      if (this.videoElement && !this.videoElement.paused) {
        const newTime = this.videoElement.currentTime;
        // Optimization: only trigger state update if time changed by more than ~8ms (half a frame at 60fps)
        // or for better reactivity, just update if changed at all.
        if (Math.abs(newTime - this.currentTime) > 0.008) {
          this.currentTime = newTime;
          
          this.dispatchEvent(new CustomEvent('time-update', {
            detail: { currentTime: this.currentTime },
            bubbles: true,
            composed: true
          }));
        }
        this._rafId = requestAnimationFrame(loop);
      }
    };
    this._rafId = requestAnimationFrame(loop);
  }

  private _stopRafLoop() {
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = 0;
    }
  }

  private _dispatchPlaybackStatus() {
    this.dispatchEvent(new CustomEvent('playback-status-changed', {
      detail: { isPlaying: this.isPlaying },
      bubbles: true,
      composed: true
    }));
  }

  private handleTimeUpdate = (): void => {
    // Rely on RAF loop for actual time updates during playback
    // Fallback for seeking or scrubing
    if (Math.abs(this.videoElement.currentTime - this.currentTime) > 0.1) {
       this.currentTime = this.videoElement.currentTime;
    }

    this.dispatchEvent(new CustomEvent('time-update', {
      detail: { currentTime: this.currentTime },
      bubbles: true,
      composed: true
    }));

    // Handle segment jump cuts (now single segment to match user request)
    if (this.segments && this.segments.length > 0) {
      const seg = this.segments[0];
      if (this.currentTime < seg.startTime) {
        this.videoElement.currentTime = seg.startTime;
        if (this.bgVideoElement) this.bgVideoElement.currentTime = seg.startTime;
      } else if (this.currentTime >= seg.endTime) {
        this.videoElement.currentTime = seg.startTime;
        if (this.bgVideoElement) this.bgVideoElement.currentTime = seg.startTime;
      }
      return;
    }

    // Legacy single segment logic
    if (this.endTime > 0 && this.currentTime >= this.endTime) {
      this.videoElement.currentTime = this.startTime;
      if (this.bgVideoElement) this.bgVideoElement.currentTime = this.startTime;
      void this.videoElement.play();
      if (this.bgVideoElement) void this.bgVideoElement.play().catch(() => { });
    }

    if (this.startTime > 0 && this.currentTime < this.startTime) {
      this.videoElement.currentTime = this.startTime;
      if (this.bgVideoElement) this.bgVideoElement.currentTime = this.startTime;
    }
  }

  /**
   * Public method to seek to a specific time
   */
  public seekTo(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
    if (this.bgVideoElement) {
      this.bgVideoElement.currentTime = time;
    }
  }

  /**
   * Public method to play a specific segment
   */
  public playSegment(startTime: number, endTime: number): void {
    this.startTime = startTime;
    this.endTime = endTime;

    if (this.videoElement) {
      this.videoElement.currentTime = startTime;
      if (this.bgVideoElement) this.bgVideoElement.currentTime = startTime;

      this.videoElement.play()
        .catch(e => console.error('[YtsShortPlayer] Play failed', e));
      if (this.bgVideoElement) this.bgVideoElement.play().catch(() => { });

      this.isPlaying = true;
      this._dispatchPlaybackStatus();
    }
  }

  private handleLoadedMetadata(): void {
    this.duration = this.videoElement.duration;
  }

  private handleEnded(): void {
    this.isPlaying = false;
    this._dispatchPlaybackStatus();
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this._handleKeydown);
  }

  disconnectedCallback() {
    this._stopRafLoop();
    window.removeEventListener('keydown', this._handleKeydown);
    super.disconnectedCallback();
  }

  private _handleKeydown = (e: KeyboardEvent) => {
    // Only handle if not typing in an input (native or custom)
    const activeElement = e.composedPath()[0] as HTMLElement;
    const isInput =
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement.tagName?.startsWith('SL-') ||
      activeElement.isContentEditable;

    if (isInput) return;

    if (e.key.toLowerCase() === 'u') {
      this._markDelta('in', -1);
    } else if (e.key.toLowerCase() === 'i') {
      this._markDelta('in', 1);
    } else if (e.key.toLowerCase() === 'o') {
      this._markDelta('out', -1);
    } else if (e.key.toLowerCase() === 'p') {
      this._markDelta('out', 1);
    } else if (e.code === 'Space') {
      e.preventDefault();
      this.togglePlay();
    }
  };

  private _markDelta(boundary: 'in' | 'out', delta: number) {
    this.dispatchEvent(new CustomEvent('mark-delta', {
      detail: { boundary, delta },
      bubbles: true,
      composed: true
    }));
  }

  private formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      width: 100%;
      --yts-player-border-radius: 24px;
      --yts-sidebar-width: 140px;
    }

    .player-wrapper {
      display: flex;
      flex-direction: row;
      gap: 20px;
      height: 100%;
      width: 100%;
      justify-content: center;
      align-items: center;
    }

    .reel-frame {
      aspect-ratio: 9/16;
      height: 95%; /* Leave some breathing room */
      background: #0f172a;
      border-radius: var(--yts-player-border-radius);
      overflow: hidden;
      position: relative;
      border: 4px solid rgba(148, 163, 184, 0.4);
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      flex-shrink: 0;
      transition: all 0.3s ease;
    }

    .video-area {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      z-index: 1;
      container-type: size; /* Essential for cqw/cqh units in subtitles */
    }

    .video-background {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      filter: blur(30px) brightness(0.8);
      transform: scale(1.1);
      z-index: 0;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .video-background.visible {
      opacity: 1;
    }

    .video-surface {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }

    video {
      position: relative;
      z-index: 2; /* Sit above background */
      width: 100%;
      height: 100%;
      background: #000; /* Default Fallback */
      transition: object-position 0.2s ease-out, transform 0.3s ease;
    }

    video.fill {
      object-fit: cover;
    }

    video.fullscreen {
      object-fit: contain;
      background: transparent; /* Allow background video to show through */
    }

    /* Top Overlay (Header) */
    .top-overlay {
        position: absolute;
        top: 20px;
        left: 0;
        right: 0;
        padding: 0 20px;
        display: flex;
        justify-content: space-between;
        color: white;
        z-index: 1;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
        pointer-events: none;
    }

    .top-overlay sl-icon {
        pointer-events: auto;
        cursor: pointer;
    }

    /* Floating Text Bubble */
    .text-bubble {
      position: absolute;
      bottom: 160px; /* Moved up to clear play button */
      left: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.15); /* Glassy bubble */
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 12px;
      padding: 16px 40px 16px 16px; /* Extra padding on right for icon */
      color: white;
      font-size: 20px; /* Larger text for realism */
      font-weight: 600;
      line-height: 1.4;
      z-index: 2;
      box-shadow: 0 4px 15px rgba(0,0,0,0.2);
      transition: all 0.2s ease;
      cursor: text;
    }

    .text-bubble:focus-within {
        background: rgba(255, 255, 255, 0.25);
        border-color: rgba(255, 255, 255, 0.6);
        outline: none;
    }

    .bubble-pointer {
        position: absolute;
        right: 12px;
        top: 12px;
        color: white;
        opacity: 0.8;
        cursor: pointer;
        background: rgba(0,0,0,0.2);
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Controls Overlay */
    .controls-overlay {
      position: absolute;
      bottom: 20px;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      z-index: 2;
      padding: 0 10px;
      pointer-events: none;
    }

    .play-btn, .nudge-group, .progress-bar-btn, .text-bubble {
        pointer-events: auto;
    }

    .play-btn {
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        border-radius: 50%;
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid rgba(255,255,255,0.1);
        margin-bottom: 8px; /* Space between btn and bar */
        padding: 0;
    }

    .play-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
    }

    .play-btn:focus-visible {
        outline: 2px solid white;
        outline-offset: 2px;
    }

    .progress-container {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .time-display {
        font-family: monospace;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
        min-width: 80px;
        text-align: center;
    }

    .progress-bar-track {
        width: 100%;
        height: 4px;
        background: rgba(255,255,255,0.2);
        border-radius: 2px;
        position: relative;
    }

    .progress-fill {
        height: 100%;
        background: white;
        border-radius: 2px;
        transition: width 0.1s linear;
    }

    .capture-controls {
        display: flex;
        gap: 6px;
        margin-bottom: 4px;
    }

    .nudge-group {
        display: flex;
        align-items: center;
        background: rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        padding: 4px 10px;
        gap: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }

    .nudge-label {
        font-size: 9px;
        font-weight: 900;
        color: #818cf8; /* Indigo accent */
        margin-right: 2px;
        letter-spacing: 1px;
    }

    .nudge-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.15);
        color: white;
        padding: 4px 10px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
        transition: all 0.2s ease;
    }

    .nudge-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
        transform: translateY(-1px);
    }

    .nudge-btn:active {
        transform: translateY(0);
        background: rgba(255, 255, 255, 0.15);
    }

    .nudge-btn sl-icon {
        font-size: 13px;
    }

    /* Sidebar Controls */
    .editor-sidebar {
      width: var(--yts-sidebar-width);
      display: flex;
      flex-direction: column;
      gap: 24px;
      padding: 24px 20px;
      background: #1e293b;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      height: fit-content;
      box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      flex-shrink: 0;
    }

    .sidebar-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .sidebar-title {
      font-size: 10px;
      font-weight: 800;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 1px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .layout-toggle {
      display: flex;
      width: 100%;
    }

    .layout-btn {
      width: 100%;
      padding: 12px;
      border: none;
      background: #0f172a;
      color: #94a3b8;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 13px;
      font-weight: 600;
    }

    .layout-btn:hover {
      background: #334155;
      color: white;
    }

    .layout-btn.active {
      background: #818cf8;
      color: white;
    }

    .key-btn {
      width: 100%;
      padding: 12px;
      border: none;
      background: #0f172a;
      color: #94a3b8;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 600;
      transition: all 0.2s;
    }

    .key-btn:hover {
      background: #334155;
      color: white;
    }

    .key-btn.active {
      background: #ef4444;
      color: white;
    }

    .pan-sidebar-control {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .pan-slider {
      width: 100%;
      accent-color: #818cf8;
      cursor: pointer;
    }

    .pan-value {
      font-family: monospace;
      font-size: 11px;
      color: #818cf8;
      text-align: right;
    }

    .pan-sidebar-control.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .pan-sidebar-control.disabled .pan-slider {
      cursor: not-allowed;
    }
  `;

  render(): unknown {
    console.log('[YtsShortPlayer] render()', {
      src: this.src,
      currentTime: this.currentTime,
      isPlaying: this.isPlaying,
      segments: (this.segments || []).length,
      layout: this.getCurrentLayout()
    });
    const isSegment = this.endTime > 0 && this.endTime > this.startTime;
    const effectiveDuration = isSegment ? (this.endTime - this.startTime) : this.duration;

    // Calculate relative current time for display
    let effectiveCurrentTime = this.currentTime;
    if (isSegment) {
      effectiveCurrentTime = Math.max(0, this.currentTime - this.startTime);
    }

    // Progress is relative to the segment
    let progressPercent = 0;
    if (this.segments && this.segments.length > 0) {
      const seg = this.segments[0];
      const segDur = seg.endTime - seg.startTime;
      progressPercent = segDur > 0 ? ((this.currentTime - seg.startTime) / segDur) * 100 : 0;
    } else {
      progressPercent = effectiveDuration > 0
        ? (effectiveCurrentTime / effectiveDuration) * 100
        : 0;
    }

    return html`
      <div class="player-wrapper">
        <div class="reel-frame">
          <div class="video-area">
            ${this._renderTopOverlay(isSegment)}
            ${this._renderVideoSurface()}
            ${this._renderSubtitleOverlay()}
            ${this._renderControlsOverlay(effectiveCurrentTime, effectiveDuration, progressPercent)}
          </div>
        </div>
        
        <div class="editor-sidebar">
          <div class="sidebar-section">
            <div class="sidebar-title">
              <sl-icon name="aspect-ratio"></sl-icon>
              Layout
            </div>
            ${this._renderLayoutControls()}
          </div>
          
          <div class="sidebar-section">
            <div class="sidebar-title">
              <sl-icon name="key"></sl-icon>
              Keyframes
            </div>
            ${this._renderKeyframeIndicator()}
          </div>
        
          <div class="sidebar-section">
            <div class="sidebar-title">
              <sl-icon name="arrows-move"></sl-icon>
              Camera Pan
            </div>
            ${this._renderPanControl()}
          </div>
        </div>
      </div>
    `;
  }

  private _renderTopOverlay(isSegment: boolean) {
    return html`
        <div class="top-overlay">
           <span>${isSegment ? 'Viral Moment' : 'YouTube Short'}</span>
           <sl-icon name="info-circle" aria-label="Short info"></sl-icon>
        </div>
      `;
  }

  private _renderVideoSurface() {
    const layoutMode = this._currentLayoutMode;
    const centerX = this._currentCenterX;
    // centerX is 0-1, object-position works best with percentage
    const objectPosition = `${centerX * 100}% center`;
    console.log('[YtsShortPlayer] _renderVideoSurface', { layoutMode, centerX, objectPosition });

    return html`
        <button class="video-surface" aria-label="Toggle playback" @click="${this.togglePlay}">
          <video
            class="video-background ${layoutMode === 'fullscreen' ? 'visible' : ''}"
            src="${this.src}"
            style="object-position: 50% center;"
            muted
            loop
            playsinline
          ></video>
          <video
            id="main-video"
            class="${layoutMode}"
            src="${this.src}"
            style="object-position: ${objectPosition};"
            loop
            playsinline
            @timeupdate="${this.handleTimeUpdate}"
            @loadedmetadata="${this.handleLoadedMetadata}"
            @ended="${this.handleEnded}"
            @error="${(e: Event) => console.error('[YtsShortPlayer] Video Error', (e.target as HTMLVideoElement).error)}"
          ></video>
        </button>
      `;
  }

  private _renderLayoutControls() {
    const mode = this._currentLayoutMode;
    const isFill = mode === 'fill';
    const nextMode = isFill ? 'fullscreen' : 'fill';

    return html`
        <div class="layout-toggle">
          <button 
            class="layout-btn ${mode === 'fullscreen' ? 'active' : ''}" 
            @click=${() => this._updateLayout(nextMode)}
            title="Toggle Layout (Fill / Fullscreen)"
          >
            <sl-icon name="${isFill ? 'aspect-ratio-fill' : 'fullscreen'}"></sl-icon>
            ${isFill ? 'Layout: Fill' : 'Layout: Fullscreen'}
          </button>
        </div>
    `;
  }

  private _renderKeyframeIndicator() {
    const layoutMode = this._currentLayoutMode;
    const isFullscreen = layoutMode === 'fullscreen';
    const seg = this._activeSegment;
    const hasKeyframe = seg?.layoutTimeline?.some(ev => Math.abs(ev.timestamp - this.currentTime) < 0.1);

    // If fullscreen, the user says "le bouton remove key est actif"
    const showRemove = isFullscreen || hasKeyframe;
    const icon = showRemove ? 'dash-circle' : 'plus-circle';
    const label = showRemove ? 'Remove Key' : 'Add Keyframe';

    return html`
        <button 
          class="key-btn ${showRemove ? 'active' : ''}"
          @click=${() => this._toggleKeyframe()}
          aria-label="${label}"
        >
          <sl-icon name="${icon}"></sl-icon>
          ${label}
        </button>
    `;
  }

  private _renderPanControl() {
    const layoutMode = this._currentLayoutMode;
    const isFullscreen = layoutMode === 'fullscreen';
    const effectiveCenterX = isFullscreen ? 0.5 : this._currentCenterX;

    return html`
      <div class="pan-sidebar-control ${isFullscreen ? 'disabled' : ''}">
        <div class="pan-value">Center: ${Math.round(effectiveCenterX * 100)}%</div>
        <input 
          type="range" 
          class="pan-slider"
          min="0" 
          max="1" 
          step="0.01" 
          .value=${String(effectiveCenterX)}
          ?disabled=${isFullscreen}
          @input=${() => {
        // High frequency update for UI preview only
        this._updateLocalPanPreview();
      }}
          @change=${(e: Event) => {
        // Low frequency update for persistence
        const val = Number((e.target as HTMLInputElement).value);
        this._updatePan(val);
      }}
        >
      </div>
    `;
  }

  private _updateLocalPanPreview() {
    // This allows real-time preview without overwhelming the backend
    this.requestUpdate();
  }

  private _updateLayout(mode: 'fill' | 'fullscreen') {
    console.log('[YtsShortPlayer] _updateLayout dispatching layout-changed', { mode, time: this.currentTime });
    this.dispatchEvent(new CustomEvent('layout-changed', {
      detail: { layoutMode: mode, timestamp: this.currentTime },
      bubbles: true,
      composed: true
    }));
  }

  private _updatePan(centerX: number) {
    console.log('[YtsShortPlayer] _updatePan dispatching pan-changed', { centerX, time: this.currentTime });
    this.dispatchEvent(new CustomEvent('pan-changed', {
      detail: { centerX, timestamp: this.currentTime },
      bubbles: true,
      composed: true
    }));
  }

  private _toggleKeyframe() {
    const layoutMode = this._currentLayoutMode;
    const isFullscreen = layoutMode === 'fullscreen';
    const seg = this._activeSegment;
    const hasKeyframe = seg?.layoutTimeline?.some(ev => Math.abs(ev.timestamp - this.currentTime) < 0.1);
    
    // Explicitly determine intent based on UI state (matches user rules)
    const intent = (isFullscreen || hasKeyframe) ? 'remove' : 'add';

    console.log('[YtsShortPlayer] _toggleKeyframe dispatching toggle-keyframe', { time: this.currentTime, intent });
    this.dispatchEvent(new CustomEvent('toggle-keyframe', {
      detail: { timestamp: this.currentTime, intent },
      bubbles: true,
      composed: true
    }));
  }

  private _renderSubtitleOverlay() {
    return html`
        <yts-subtitle-overlay
            .currentTime=${this.currentTime}
            .subtitles=${this.subtitles}
            .subtitleStyle=${this.subtitleStyle}
            @subtitle-clicked=${(e: CustomEvent): void => {
        if (this.videoElement && !this.videoElement.paused) {
          this.videoElement.pause();
          this.isPlaying = false;
        }
        this.dispatchEvent(new CustomEvent('edit-subtitle', { detail: e.detail, bubbles: true, composed: true }));
      }}
            @subtitle-moved=${(e: CustomEvent): void => {
        const newStyle = {
          ...(this.subtitleStyle || {}),
          positionX: e.detail.positionX,
          positionY: e.detail.positionY
        };
        this.dispatchEvent(new CustomEvent('style-changed', {
          detail: { subtitleStyle: newStyle },
          bubbles: true,
          composed: true
        }));
      }}
        ></yts-subtitle-overlay>
      `;
  }

  private _renderControlsOverlay(effectiveCurrentTime: number, effectiveDuration: number, progressPercent: number) {
    return html`
        <div class="controls-overlay">
          ${this._renderNudgeControls()}
          ${this._renderProgressDisplay(effectiveCurrentTime, effectiveDuration, progressPercent)}
        </div>
      `;
  }

  private _renderNudgeControls() {
    return html`
        <div class="capture-controls">
            <div class="nudge-group">
                <span class="nudge-label">IN</span>
                <button class="nudge-btn" @click=${() => this._markDelta('in', -1)} title="In -1s (U)">
                <sl-icon name="dash-circle"></sl-icon> U
                </button>
                <button class="nudge-btn" @click=${() => this._markDelta('in', 1)} title="In +1s (I)">
                <sl-icon name="plus-circle"></sl-icon> I
                </button>
            </div>
            
            <div class="nudge-group">
                <span class="nudge-label">OUT</span>
                <button class="nudge-btn" @click=${() => this._markDelta('out', -1)} title="Out -1s (O)">
                <sl-icon name="dash-circle"></sl-icon> O
                </button>
                <button class="nudge-btn" @click=${() => this._markDelta('out', 1)} title="Out +1s (P)">
                <sl-icon name="plus-circle"></sl-icon> P
                </button>
            </div>
        </div>
      `;
  }

  private _renderProgressDisplay(effectiveCurrentTime: number, effectiveDuration: number, progressPercent: number) {
    return html`
        <div class="progress-container">
             <div class="time-display">
                ${this.formatTime(effectiveCurrentTime)} / ${this.formatTime(effectiveDuration)}
             </div>
             <button class="progress-bar-btn" aria-label="Seek" @click="${this.seek}">
                <div class="progress-bar-track">
                    <div class="progress-fill" style="width: ${Math.min(100, Math.max(0, progressPercent))}%"></div>
                </div>
             </button>
        </div>
      `;
  }

  private seek(e: MouseEvent): void {
    if (!this.duration || !this.videoElement) {
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;

    const isSegment = this.endTime > 0 && this.endTime > this.startTime;

    if (isSegment) {
      // Seek relative to segment
      const seg = this.segments?.length > 0 ? this.segments[0] : { startTime: this.startTime, endTime: this.endTime };
      const segmentDuration = seg.endTime - seg.startTime;
      const targetTime = seg.startTime + (percent * segmentDuration);
      this.videoElement.currentTime = targetTime;
    } else {
      // Seek relative to full video
      const targetTime = percent * this.duration;
      this.videoElement.currentTime = targetTime;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yts-short-player': YtsShortPlayer;
  }
}
