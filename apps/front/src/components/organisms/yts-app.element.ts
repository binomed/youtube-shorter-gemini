import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
import { LitElement, html, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { Router } from '@vaadin/router';
import { projectService } from '../../services/project.service.js';
import { setProject } from '../../state/project.state.js';
import '../layouts/yts-main-layout.element.js';

import '../../pages/dashboard-page.js';
import '../../pages/analysis-page.js';
import '../../pages/editor-page.js';

// Set the base path to the CDN for icons
setBasePath('https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@2.19.1/cdn/');

/**
 * Root application component.
 *
 * Responsibilities:
 * - Manages routing via @vaadin/router
 * - Handles global events like project creation and analysis completion
 * - Manages global project state updates
 *
 * @element yts-app
 */
@customElement('yts-app')
export class YtsApp extends LitElement {
  @query('#outlet')
  private outlet!: HTMLElement;

  static styles = css`
    :host {
      display: block;
    }
  `;

  protected firstUpdated(): void {
    const router = new Router(this.outlet);
    router.setRoutes([
      { path: '/', component: 'dashboard-page' },
      { path: '/analysis/:projectId', component: 'analysis-page' },
      { path: '/editor/:projectId', component: 'editor-page' },
      { path: '(.*)', redirect: '/' },
    ]);
  }

  /**
   * Handles the 'project-created' event from the Dashboard.
   * Uploads video to backend, sets global state, then navigates to Analysis page.
   */
  private async handleProjectCreated(e: CustomEvent): Promise<void> {
    const { name, file } = e.detail;

    try {
      // Upload video to backend first
      const dto = { name, deletionPolicyAcknowledged: true, aiLearningConsent: false };
      const projectResponse = await projectService.createProject(dto, file);

      // Update global state
      setProject(projectResponse);

      // Navigate to analysis page
      Router.go(`/analysis/${projectResponse.id}`);
    } catch (err: unknown) {
      console.error('Failed to upload project:', err);
      // Show error to user
      const message = err instanceof Error ? err.message : 'Unknown error';
      alert(`Upload Failed: ${message}`);
    }
  }

  /**
   * Handles the 'analysis-complete' event from the Analysis page.
   * Navigates to the Editor.
   */
  private handleAnalysisComplete(e: CustomEvent): void {
    const projectId = e.detail.projectId || e.detail.id;
    if (projectId) {
      Router.go(`/editor/${projectId}`);
    } else {
      console.error('Analysis complete event missing projectId');
    }
  }

  render(): unknown {
    return html`
      <yts-main-layout>
        <div id="router-outlet"
             @create-project=${this.handleProjectCreated}
             @analysis-complete=${this.handleAnalysisComplete}
        ></div>
      </yts-main-layout>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yts-app': YtsApp;
  }
}
