/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { SignalWatcher } from '@lit-labs/signals';
import { Router, type BeforeEnterObserver, type RouterLocation } from '@vaadin/router';
import type { AnalysisProgressEvent } from '@youtube-shorter/shared';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import { projectService } from '../services/project.service.js';
import { projectSignal, setProject } from '../state/project.state.js';

/**
 * Analysis loading page — transitional screen between Dashboard and Editor.
 *
 * Shows animated progress phases as Gemini analyzes the video:
 * - Phase 1: Extracting video frames (FFmpeg)
 * - Phase 2: Analyzing with AI (Gemini)
 * - Phase 3: Preparing your Shorts (saving results)
 *
 * Auto-dispatches 'analysis-complete' when done.
 *
 * @element analysis-page
 * @fires analysis-complete - When analysis finishes successfully
 */
@customElement('analysis-page')
export class AnalysisPage extends SignalWatcher(LitElement) implements BeforeEnterObserver {

  @state() private currentPhase: AnalysisProgressEvent['phase'] = 'extracting_frames';
  @state() private progress = 0;
  @state() private message = 'Initializing analysis...';
  @state() private error: string | null = null;
  @state() private loadingProject = false;
  @state() private phases: { key: string; label: string; icon: string; done: boolean }[] = [
    { key: 'extracting_frames', label: 'Extracting video frames', icon: '🎬', done: false },
    { key: 'analyzing', label: 'Analyzing with Gemini AI', icon: '✨', done: false },
    { key: 'saving', label: 'Preparing your Shorts', icon: '💾', done: false },
  ];

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 50%, #0a0a1a 100%);
      color: white;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
    }

    .analysis-container {
      text-align: center;
      max-width: 500px;
      padding: 48px;
    }

    .brand-icon {
      font-size: 64px;
      margin-bottom: 24px;
      animation: pulse 2s ease-in-out infinite;
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.1); opacity: 0.8; }
    }

    h1 {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 8px 0;
      background: linear-gradient(135deg, #6366f1, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .subtitle {
      color: #94a3b8;
      font-size: 14px;
      margin-bottom: 40px;
    }

    /* Progress bar */
    .progress-track {
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 32px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #a78bfa, #6366f1);
      background-size: 200% 100%;
      border-radius: 3px;
      transition: width 0.5s ease;
      animation: shimmer 2s infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    /* Phase list */
    .phases {
      display: flex;
      flex-direction: column;
      gap: 16px;
      text-align: left;
    }

    .phase {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.3s ease;
      opacity: 0.4;
    }

    .phase.active {
      opacity: 1;
      background: rgba(99, 102, 241, 0.1);
      border-color: rgba(99, 102, 241, 0.3);
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.1);
    }

    .phase.done {
      opacity: 0.7;
    }

    .phase-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .phase-label {
      font-size: 15px;
      font-weight: 500;
    }

    .phase-check {
      margin-left: auto;
      color: #22c55e;
      font-size: 18px;
    }

    .spinner {
      margin-left: auto;
      width: 20px;
      height: 20px;
      border: 2px solid rgba(99, 102, 241, 0.3);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .status-message {
      margin-top: 24px;
      color: #94a3b8;
      font-size: 13px;
    }

    .error-message {
      margin-top: 24px;
      color: #ef4444;
      font-size: 14px;
      padding: 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.2);
      border-radius: 8px;
    }

    .home-button {
      position: absolute;
      top: 24px;
      left: 24px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      transition: all 0.2s;
      text-decoration: none;
    }

    .home-button:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
    }
  `;

  async onBeforeEnter(location: RouterLocation): Promise<void> {
    const projectId = location.params.projectId as string;

    // If no project or different project, fetch it
    const currentProject = projectSignal.get();
    if (!currentProject || currentProject.id !== projectId) {
      this.loadingProject = true;
      try {
        const project = await projectService.getProject(projectId);
        setProject(project);
      } catch (err) {
        console.error('Failed to load project:', err);
        this.error = 'Failed to load project details.';
        // Handle error (e.g. redirect to dashboard or show error)
      } finally {
        this.loadingProject = false;
      }
    }

    // Once loaded (and redundant check), start analysis if no error
    const project = projectSignal.get();
    if (project && !this.error) {
      // We should ensure we don't restart analysis if it's already done?
      // Actually, analysis endpoint might be idempotent or we rely on backend state.
      // But this page is "AnalysisPage", strictly for the progress.
      // If already analyzed (e.g. resuming), we might want to check status first.
      // For now, assuming startAnalysis is safe to call or handles re-connection.
      this.startAnalysis();
    }
  }

  /**
   * Starts the analysis by connecting to SSE for progress,
   * then triggering the POST /analyze endpoint.
   */
  private async startAnalysis(): Promise<void> {
    const project = projectSignal.get();
    if (!project?.id) return;

    const projectId = project.id;

    // Connect to SSE for progress updates
    const eventSource = new EventSource(`/api/projects/${projectId}/analyze/progress`);

    eventSource.addEventListener('analysis-progress', (event: MessageEvent) => {
      try {
        const data: AnalysisProgressEvent = JSON.parse(event.data);
        this.handleProgressEvent(data);

        if (data.phase === 'complete') {
          eventSource.close();
          // Small delay for the user to see "complete"
          setTimeout(() => {
            this.dispatchEvent(new CustomEvent('analysis-complete', {
              bubbles: true,
              composed: true,
              detail: { projectId },
            }));
          }, 1000);
        }

        if (data.phase === 'error') {
          eventSource.close();
          this.error = data.message;
        }
      } catch (e) {
        console.error('Failed to parse SSE event:', e);
      }
    });

    eventSource.onerror = (): void => {
      // SSE may error before analyze starts, that's ok — we'll get events once analysis begins
    };

    // Trigger the analysis (fire-and-forget, SSE handles progress)
    try {
      const response = await fetch(`/api/projects/${projectId}/analyze`, {
        method: 'POST',
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        this.error = (errData as Record<string, string>).message || 'Analysis failed';
        eventSource.close();
      }
    } catch (err) {
      this.error = `Network error: ${(err as Error).message}`;
      eventSource.close();
    }
  }

  private handleProgressEvent(event: AnalysisProgressEvent): void {
    this.currentPhase = event.phase;
    this.progress = event.progress;
    this.message = event.message;

    // Update phase states
    const phaseOrder = ['extracting_frames', 'analyzing', 'saving', 'complete'];
    const currentIndex = phaseOrder.indexOf(event.phase);

    this.phases = this.phases.map((p, i) => ({
      ...p,
      done: i < currentIndex || event.phase === 'complete',
    }));
  }

  render(): unknown {
    if (this.loadingProject) {
      return html`
                <div class="analysis-container">
                    <div class="spinner" style="width: 40px; height: 40px; margin: 0 auto; border-width: 4px;"></div>
                    <p class="status-message">Loading project...</p>
                </div>
            `;
    }

    const project = projectSignal.get();

    return html`
      <a class="home-button" @click="${(): void => { Router.go('/'); }}">
        <sl-icon name="house-door-fill"></sl-icon> Home
      </a>
      <div class="analysis-container">
        <div class="brand-icon">🧠</div>
        <h1>Analyzing Your Video</h1>
        <p class="subtitle">${project?.name || 'Untitled Project'}</p>

        <div class="progress-track">
          <div class="progress-fill" style="width: ${this.progress}%"></div>
        </div>

        <div class="phases">
          ${this.phases.map((phase) => {
      const isActive = phase.key === this.currentPhase;
      return html`
              <div class="phase ${isActive ? 'active' : ''} ${phase.done ? 'done' : ''}">
                <span class="phase-icon">${phase.icon}</span>
                <span class="phase-label">${phase.label}</span>
                ${phase.done
          ? html`<span class="phase-check">✓</span>`
          : isActive
            ? html`<div class="spinner"></div>`
            : html``
        }
              </div>
            `;
    })}
        </div>

        <p class="status-message">${this.message}</p>

        ${this.error ? html`<div class="error-message">${this.error}</div>` : ''}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'analysis-page': AnalysisPage;
  }
}
