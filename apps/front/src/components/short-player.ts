/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import type { SubtitleResponse, SubtitleStyle, VideoSegment } from '@youtube-shorter/shared';
import './molecules/yts-subtitle-overlay.element.js';

/**
 * Component for playing and editing short-form videos.
 *
 * Features:
 * - Displays video preview with overlay controls
 * - Editable floating caption
 * - Play/Pause functionality
 * - Used in the Editor Page for final adjustments
 *
 * @element short-player
 */
@customElement('short-player')
export class ShortPlayer extends LitElement {
  @property({ type: String }) src = '';
  @property({ type: String }) caption = '';
  @property({ type: Array }) subtitles: SubtitleResponse[] = [];
  @property({ type: Object }) subtitleStyle?: SubtitleStyle;
  @property({ type: Number }) startTime = 0;
  @property({ type: Number }) endTime = 0;
  @property({ type: Array }) segments: VideoSegment[] = [];

  @query('video') videoElement!: HTMLVideoElement;
  @state() private isPlaying = false;
  @state() private currentTime = 0;
  @state() private duration = 0;

  private togglePlay(): void {
    if (!this.videoElement) return;
    if (this.videoElement.paused) {
      void this.videoElement.play();
      this.isPlaying = true;
    } else {
      this.videoElement.pause();
      this.isPlaying = false;
    }
  }

  private handleTimeUpdate = (): void => {
    this.currentTime = this.videoElement.currentTime;

    // Handle segment jump cuts (now single segment to match user request)
    if (this.segments && this.segments.length > 0) {
      const seg = this.segments[0];
      if (this.currentTime < seg.startTime) {
        this.videoElement.currentTime = seg.startTime;
      } else if (this.currentTime >= seg.endTime) {
        this.videoElement.currentTime = seg.startTime;
      }
      return;
    }

    // Legacy single segment logic
    if (this.endTime > 0 && this.currentTime >= this.endTime) {
      this.videoElement.currentTime = this.startTime;
      void this.videoElement.play();
    }

    if (this.startTime > 0 && this.currentTime < this.startTime) {
      this.videoElement.currentTime = this.startTime;
    }
  }

  /**
   * Public method to seek to a specific time
   */
  public seekTo(time: number): void {
    if (this.videoElement) {
      this.videoElement.currentTime = time;
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
      this.videoElement.play()
        .catch(e => console.error('[ShortPlayer] Play failed', e));
      this.isPlaying = true;
    }
  }



  private handleLoadedMetadata(): void {
    this.duration = this.videoElement.duration;
  }

  private handleEnded(): void {
    this.isPlaying = false;
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this._handleKeydown);
  }

  disconnectedCallback() {
    window.removeEventListener('keydown', this._handleKeydown);
    super.disconnectedCallback();
  }

  private _handleKeydown = (e: KeyboardEvent) => {
    // Only handle if not typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

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
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      aspect-ratio: 9/16;
      position: relative;
      margin: 0 auto;
      min-height: 0;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .player-container {
      width: 100%;
      height: 100%;
      background: #000;
      border-radius: 24px;
      overflow: hidden;
      position: relative;
      border: 4px solid rgba(50, 50, 50, 0.5); /* Device bezel look */
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }

    /* Video Placeholder */
    .video-surface {
      width: 100%;
      height: 100%;
      background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #475569;
      font-size: 14px;
      cursor: pointer;
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

    .play-btn, .nudge-group, .progress-bar, .text-bubble {
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
    }

    .play-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
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

    .progress-bar {
        flex: 1;
        height: 4px;
        background: rgba(255,255,255,0.2);
        border-radius: 2px;
        position: relative;
        cursor: pointer;
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
  `;

  render(): unknown {
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
      <div class="player-container">

        <!-- Top Info -->
        <div class="top-overlay">
           <span>${isSegment ? 'Viral Moment' : 'YouTube Short'}</span>
           <sl-icon name="info-circle"></sl-icon>
        </div>

        <!-- Video Content -->
        <div class="video-surface" @click="${this.togglePlay}">
          <video
            src="${this.src}"
            style="width: 100%; height: 100%; object-fit: cover;"
            loop
            playsinline
            @timeupdate="${this.handleTimeUpdate}"
            @loadedmetadata="${this.handleLoadedMetadata}"
            @ended="${this.handleEnded}"
          ></video>
        </div>

        <!-- Dynamic Subtitles -->
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
        // Dispatch style-changed so editor-page saves the new position exactly like the style panel does
        this.dispatchEvent(new CustomEvent('style-changed', {
          detail: { subtitleStyle: newStyle },
          bubbles: true,
          composed: true
        }));
      }}
        ></yts-subtitle-overlay>

        <!-- Controls -->
        <div class="controls-overlay">
          <div class="play-btn" @click="${(e: Event): void => { e.stopPropagation(); this.togglePlay(); }}">
             <sl-icon name="${this.isPlaying ? 'pause-fill' : 'play-fill'}" style="color: white; font-size: 28px;"></sl-icon>
          </div>

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

          <div class="progress-container">
             <div class="time-display">
                ${this.formatTime(effectiveCurrentTime)} / ${this.formatTime(effectiveDuration)}
             </div>
             <div class="progress-bar" @click="${this.seek}">
                <div class="progress-fill" style="width: ${Math.min(100, Math.max(0, progressPercent))}%"></div>
             </div>
          </div>
        </div>

      </div>
    `;
  }

  private seek(e: MouseEvent): void {
    if (!this.duration || !this.videoElement) {
      return;
    }

    const rect = (e.target as HTMLElement).getBoundingClientRect();
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
    'short-player': ShortPlayer;
  }
}
