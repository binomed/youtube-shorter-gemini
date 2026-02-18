/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
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
  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      max-width: 400px; /* Typical phone width */
      aspect-ratio: 9/16;
      position: relative;
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
      bottom: 40px;
      left: 0;
      right: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      z-index: 20;
    }
    
    .play-btn {
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(4px);
        border-radius: 50%;
        width: 64px;
        height: 64px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
        border: 1px solid rgba(255,255,255,0.1);
    }
    
    .play-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
    }
    
    .progress-bar {
        width: 80%;
        height: 4px;
        background: rgba(255,255,255,0.2);
        border-radius: 2px;
        position: relative;
    }
    
    .progress-fill {
        width: 30%;
        height: 100%;
        background: white;
        border-radius: 2px;
    }
    
  `;

  @property({ type: String }) src = '';
  @property({ type: String }) caption = '';

  render() {
    return html`
      <div class="player-container">
      
        <!-- Top Info -->
        <div class="top-overlay">
           <span>YouTube Short</span>
           <sl-icon name="info-circle"></sl-icon>
        </div>

        <!-- Video Content -->
        <div class="video-surface">
          <!-- Real video would go here -->
          <img 
            src="https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
            style="width:100%; height:100%; object-fit:cover; opacity:0.6;"
            alt="Demo Video"
          />
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
          <div class="play-btn">
             <sl-icon name="play-fill" style="color: white; font-size: 32px;"></sl-icon>
          </div>
          <div class="progress-bar">
            <div class="progress-fill"></div>
          </div>
        </div>
        
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'short-player': ShortPlayer;
  }
}
