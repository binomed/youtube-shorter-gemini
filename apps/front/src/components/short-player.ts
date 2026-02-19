/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';

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

  @query('video') videoElement!: HTMLVideoElement;
  @state() private isPlaying = false;
  @state() private currentTime = 0;
  @state() private duration = 0;

  private togglePlay() {
    if (!this.videoElement) return;
    if (this.videoElement.paused) {
      this.videoElement.play();
      this.isPlaying = true;
    } else {
      this.videoElement.pause();
      this.isPlaying = false;
    }
  }

  private handleTimeUpdate() {
    this.currentTime = this.videoElement.currentTime;
  }

  private handleLoadedMetadata() {
    this.duration = this.videoElement.duration;
  }

  private handleEnded() {
    this.isPlaying = false;
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
      max-width: 405px; /* 720p portrait width (720 * 9/16 = 405) */
      aspect-ratio: 9/16;
      position: relative;
      margin: 0 auto; /* Center in parent */
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
        z-index: 10;
        text-shadow: 0 1px 2px rgba(0,0,0,0.5);
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
      z-index: 20;
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
      bottom: 30px;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      z-index: 20;
      padding: 0 20px;
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
  `;

  render() {
    const progressPercent = this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0;

    return html`
      <div class="player-container">
      
        <!-- Top Info -->
        <div class="top-overlay">
           <span>YouTube Short</span>
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

        <!-- Editable Text Bubble -->
        <div class="text-bubble" contenteditable="true" spellcheck="false">
          ${this.caption}
          <div class="bubble-pointer">
             <sl-icon name="pencil-fill" style="font-size:12px;"></sl-icon>
          </div>
        </div>

        <!-- Controls -->
        <div class="controls-overlay">
          <div class="play-btn" @click="${(e: Event) => { e.stopPropagation(); this.togglePlay(); }}">
             <sl-icon name="${this.isPlaying ? 'pause-fill' : 'play-fill'}" style="color: white; font-size: 28px;"></sl-icon>
          </div>
          
          <div class="progress-container">
             <div class="time-display">
                ${this.formatTime(this.currentTime)} / ${this.formatTime(this.duration)}
             </div>
             <div class="progress-bar" @click="${this.seek}">
                <div class="progress-fill" style="width: ${progressPercent}%"></div>
             </div>
          </div>
        </div>
        
      </div>
    `;
  }

  private seek(e: MouseEvent) {
    if (!this.duration || !this.videoElement) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    this.videoElement.currentTime = percent * this.duration;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'short-player': ShortPlayer;
  }
}
