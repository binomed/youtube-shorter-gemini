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
      aspect-ratio: 9 / 16;
      background-color: var(--yts-bg-primary, black);
      border-radius: var(--yts-radius-lg);
      overflow: hidden;
      position: relative;
      box-shadow: var(--yts-shadow-md);
    }

    .video-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(45deg, #1a1a2e, #2d2d44);
      color: var(--yts-text-muted);
      font-size: var(--yts-font-size-sm);
    }

    .overlay {
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      padding: var(--yts-spacing-md);
      background: linear-gradient(to top, rgba(0,0,0,0.8), transparent);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .controls {
      display: flex;
      gap: var(--yts-spacing-sm);
    }

    .floating-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: rgba(0, 0, 0, 0.6);
      padding: var(--yts-spacing-sm) var(--yts-spacing-md);
      border-radius: var(--yts-radius-md);
      border: 2px solid transparent;
      color: white;
      font-weight: 600;
      font-size: var(--yts-font-size-lg);
      cursor: text;
      transition: all var(--yts-transition-fast);
      text-align: center;
      max-width: 80%;
    }

    .floating-text:hover, .floating-text:focus {
      border-color: var(--yts-accent);
      background-color: rgba(0, 0, 0, 0.8);
    }

    .play-button {
      font-size: 2rem;
      color: var(--yts-text-inverse, white);
    }
  `;

  @property({ type: String }) src = '';
  @property({ type: String }) caption = 'Tap to edit caption';

  render() {
    return html`
      <div class="video-placeholder">
        <!-- Video element will go here -->
        Video Preview: ${this.src}
      </div>

      <div 
        class="floating-text" 
        contenteditable="true"
        role="textbox"
        aria-label="Video Caption"
      >
        ${this.caption}
      </div>

      <div class="overlay">
        <div class="controls">
          <sl-icon-button class="play-button" name="play-fill" label="Play"></sl-icon-button>
        </div>
        <div class="meta">
          <!-- Duration or other meta -->
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
