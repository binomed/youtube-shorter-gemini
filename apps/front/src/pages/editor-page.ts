/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import '../components/short-player';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';

/**
 * Editor page component.
 * 
 * Features:
 * - Video preview using ShortPlayer
 * - Editing controls (future implementation)
 * - Project metadata display
 * 
 * @element editor-page
 */
@customElement('editor-page')
export class EditorPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100vh;
      overflow: hidden;
      background-color: var(--yts-bg-primary);
    }

    .layout {
      display: grid;
      grid-template-columns: 280px 1fr 320px;
      height: 100%;
    }

    /* Left Sidebar: Source */
    .sidebar-left {
      background-color: var(--yts-bg-secondary);
      border-right: 1px solid var(--yts-border);
      padding: var(--yts-spacing-md);
      overflow-y: auto;
    }

    .sidebar-header {
      font-size: var(--yts-font-size-lg);
      font-weight: 600;
      margin-bottom: var(--yts-spacing-md);
      color: var(--yts-text-primary);
    }

    .segment-list {
      display: flex;
      flex-direction: column;
      gap: var(--yts-spacing-md);
    }

    .segment-card {
      background-color: var(--yts-bg-card);
      border-radius: var(--yts-radius-md);
      overflow: hidden;
      cursor: pointer;
      transition: all var(--yts-transition-fast);
      border: 1px solid transparent;
    }

    .segment-card:hover {
      border-color: var(--yts-accent);
      transform: translateY(-2px);
    }

    .segment-thumb {
      height: 100px;
      background-color: #000;
      position: relative;
    }

    .segment-info {
      padding: var(--yts-spacing-sm);
    }

    .segment-title {
      font-size: var(--yts-font-size-sm);
      font-weight: 500;
      margin-bottom: var(--yts-spacing-xs);
    }

    .segment-meta {
      font-size: var(--yts-font-size-xs);
      color: var(--yts-text-muted);
    }

    /* Center: Reel */
    .reel-container {
      background-color: #000;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--yts-spacing-xl) 0;
      overflow-y: auto;
      gap: var(--yts-spacing-xl);
    }

    .short-wrapper {
      width: 100%;
      max-width: 40vh; /* Approximate phone width relative to height */
      flex-shrink: 0;
    }

    /* Right Sidebar: Tools */
    .sidebar-right {
      background-color: var(--yts-bg-secondary);
      border-left: 1px solid var(--yts-border);
      display: flex;
      flex-direction: column;
    }

    .tools-header {
      padding: var(--yts-spacing-md);
      border-bottom: 1px solid var(--yts-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .tools-content {
      padding: var(--yts-spacing-md);
      flex: 1;
      overflow-y: auto;
    }

    .tool-section {
      margin-bottom: var(--yts-spacing-xl);
    }

    .tool-title {
      font-size: var(--yts-font-size-sm);
      font-weight: 600;
      margin-bottom: var(--yts-spacing-md);
      color: var(--yts-text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    sl-range {
      margin-bottom: var(--yts-spacing-md);
      --track-color-active: var(--yts-accent);
      --thumb-size: 16px;
    }
  `;

  render() {
    return html`
      <div class="layout">
        <!-- Left: Source segments -->
        <aside class="sidebar-left">
          <div class="sidebar-header">Source Segments</div>
          <div class="segment-list">
            ${[1, 2, 3, 4].map(i => html`
              <div class="segment-card">
                <div class="segment-thumb"></div>
                <div class="segment-info">
                  <div class="segment-title">Viral Moment ${i}</div>
                  <div class="segment-meta">00:12 - 00:45 • High Potential</div>
                </div>
              </div>
            `)}
          </div>
        </aside>

        <!-- Center: Reel -->
        <main class="reel-container">
          <div class="short-wrapper">
            <short-player src="demo1.mp4" caption="This is the first generated short"></short-player>
          </div>
          <div class="short-wrapper">
             <short-player src="demo2.mp4" caption="Another viral clip here"></short-player>
          </div>
        </main>

        <!-- Right: Tools -->
        <aside class="sidebar-right">
          <div class="tools-header">
            <span style="font-weight:600">Editor Tools</span>
            <sl-button variant="primary" size="small">Export All</sl-button>
          </div>
          
          <div class="tools-content">
            <sl-tab-group>
              <sl-tab slot="nav" panel="audio">Audio</sl-tab>
              <sl-tab slot="nav" panel="captions">Captions</sl-tab>
              <sl-tab slot="nav" panel="style">Style</sl-tab>
              
              <sl-tab-panel name="audio">
                <div class="tool-section">
                  <div class="tool-title">Mixer</div>
                  <sl-range label="Voice Volume" min="0" max="100" value="80"></sl-range>
                  <sl-range label="Music Volume" min="0" max="100" value="30"></sl-range>
                </div>
              </sl-tab-panel>
              
              <sl-tab-panel name="captions">
                <div class="tool-section">
                  <div class="tool-title">Typography</div>
                  <!-- Font controls would go here -->
                  <sl-button size="small" variant="default" style="width:100%">Auto-Caption</sl-button>
                </div>
              </sl-tab-panel>
            </sl-tab-group>
          </div>
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
