import { setBasePath } from '@shoelace-style/shoelace/dist/utilities/base-path.js';
import { LitElement, html, css } from 'lit';
import { customElement, query } from 'lit/decorators.js';
import { Router } from '@vaadin/router';
import { projectService } from '../../services/project.service.js';
import { setProject } from '../../state/project.state.js';
import '../layouts/main-layout.js';
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

  firstUpdated() {
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
  private async handleProjectCreated(e: CustomEvent) {
    const { name, file } = e.detail;
    console.log('Project created event received:', { name, file: file.name });

    try {
      // Upload video to backend first
      const dto = { name, deletionPolicyAcknowledged: true, aiLearningConsent: false };
      console.log('DEBUG: Uploading project with DTO:', dto);
      const projectResponse = await projectService.createProject(dto, file);
      console.log('DEBUG: Project uploaded successfully:', projectResponse);

      // Update global state
      setProject(projectResponse);

      // Navigate to analysis page
      Router.go(`/analysis/${projectResponse.id}`);
    } catch (err: any) {
      console.error('Failed to upload project:', err);
      // Show error to user for debugging
      alert(`Upload Failed: ${err.message || 'Unknown error'}`);
    }
  }

  /**
   * Handles the 'analysis-complete' event from the Analysis page.
   * Navigates to the Editor.
   */
  private handleAnalysisComplete(e: CustomEvent) {
    console.log('Analysis complete:', e.detail);
    // Detail should contain projectId (or we can get it from state, but event is improved)
    // Assuming the event detail has the project ID or we use the current capabilities
    const projectId = e.detail.projectId || e.detail.id; // Fallback
    if (projectId) {
      Router.go(`/editor/${projectId}`);
    } else {
      console.error('Analysis complete event missing projectId');
    }
  }

  render() {
    return html`
      <main-layout>
        <div id="outlet"
             @create-project=${this.handleProjectCreated}
             @analysis-complete=${this.handleAnalysisComplete}
        ></div>
      </main-layout>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yts-app': YtsApp;
  }
}
