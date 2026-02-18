/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { ProjectResponse } from '@youtube-shorter/shared';
import '../layouts/main-layout.js';
import '../../pages/dashboard-page.js';
import '../../pages/editor-page.js';

// Set the base path to the CDN for icons
setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/cdn/');

/**
 * Root application component.
 * 
 * Responsibilities:
 * - Manages top-level state (current view, active project)
 * - Routes between Dashboard and Editor pages
 * - Handles global events like project creation
 * 
 * @element yts-app
 */
@customElement('yts-app')
export class YtsApp extends LitElement {
  @state() private currentView: 'dashboard' | 'editor' = 'dashboard';
  @state() private project: ProjectResponse | null = null;

  static styles = css`
    :host {
      display: block;
    }
  `;

  /**
   * Handles the 'project-created' event from the Dashboard.
   * - Updates the active project state
   * - Switches view to the Editor
   * 
   * @param e - CustomEvent containing the project data
   */
  private handleProjectCreated(e: CustomEvent) {
    console.log('Project created event received:', e.detail);
    this.project = e.detail;
    this.currentView = 'editor';
  }



  render() {
    return html`
      <main-layout>
        ${this.currentView === 'dashboard'
        ? html`<dashboard-page @create-project=${this.handleProjectCreated}></dashboard-page>`
        : html`<editor-page .project=${this.project}></editor-page>`
      }
      </main-layout>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yts-app': YtsApp;
  }
}
