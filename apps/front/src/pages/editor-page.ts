import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';
import '@shoelace-style/shoelace/dist/components/tab-group/tab-group.js';
import '@shoelace-style/shoelace/dist/components/tab/tab.js';
import '@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.js';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '../components/short-player.js';

@customElement('editor-page')
export class EditorPage extends LitElement {
  static styles = css`
    :host {
      display: block;
      height: 100vh;
      width: 100vw;
      background: radial-gradient(circle at 50% 50%, #232334 0%, #111116 100%);
      color: #e2e8f0;
      font-family: 'Inter', sans-serif;
      overflow: hidden;
    }

    .layout {
      display: grid;
      grid-template-columns: 280px 1fr 340px;
      height: 100%;
      gap: 24px;
      padding: 24px;
      box-sizing: border-box;
    }

    /* Glass Panel Utilities */
    .glass-panel {
      background: var(--yts-glass-bg, rgba(30, 35, 50, 0.7));
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--yts-glass-border, rgba(99, 102, 241, 0.3));
      border-radius: 20px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }
    
    .panel-header {
      font-size: 16px;
      font-weight: 500;
      color: #94a3b8;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    /* Left Sidebar: Source Segments */
    .sidebar-left {
      overflow-y: auto;
    }

    .segment-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .segment-card {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      padding: 12px;
      display: flex;
      gap: 12px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s ease;
    }

    .segment-card:hover {
      background: rgba(99, 102, 241, 0.1);
      border-color: rgba(99, 102, 241, 0.4);
    }

    .segment-thumb {
      width: 80px;
      height: 45px;
      background: #0f172a;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #475569;
    }
    
    .segment-info {
        flex: 1;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    
    .segment-title {
        font-size: 13px;
        font-weight: 500;
        color: #f1f5f9;
        margin-bottom: 4px;
    }
    
    .segment-meta {
        font-size: 11px;
        color: #64748b;
    }

    /* Center: Reel */
    .reel-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    
    .short-title {
        position: absolute;
        top: 0;
        left: 0;
        font-size: 24px;
        font-weight: 600;
        color: white;
        text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }

    /* Right Sidebar: Tools */
    .sidebar-right {
      padding: 0; /* Tabs will handle padding */
      overflow: hidden;
    }
    
    .tools-header {
        padding: 20px 20px 0 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }

    .export-btn {
      background: var(--yts-neon-blue, #4f46e5);
      border: none;
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      box-shadow: 0 0 15px rgba(79, 70, 229, 0.4);
      transition: all 0.2s;
    }
    
    .export-btn:hover {
        box-shadow: 0 0 20px rgba(79, 70, 229, 0.6);
        transform: translateY(-1px);
    }

    /* Custom Shoelace Tabs styling */
    sl-tab-group {
        height: 100%;
        --indicator-color: var(--yts-neon-blue, #6366f1);
        --track-color: rgba(255,255,255,0.05); /* Separator line */
        padding-left: 20px; /* Left margin request */
    }
    
    sl-tab {
        color: #94a3b8;
        font-weight: 500;
        margin-right: 32px; /* Increased spacing between tabs */
    }
    
    sl-tab[active] {
        color: #f8fafc;
        font-weight: 600;
    }
    
    sl-tab-panel {
        padding: 20px;
        height: calc(100% - 50px);
        overflow-y: auto;
    }

    .captions-list {
        display: flex;
        flex-direction: column;
        gap: 0;
    }

    .caption-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        color: #cbd5e1;
        font-size: 13px;
    }
    
    .caption-time {
        color: #64748b;
        font-family: monospace;
        font-size: 11px;
    }
    
    .caption-text {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }
  `;

  render() {
    return html`
      <div class="layout">
        <!-- Left: Source segments -->
        <aside class="glass-panel sidebar-left">
          <div class="panel-header">Source Segments</div>
          <div class="segment-list">
            ${[1, 2, 3, 4, 5].map(i => html`
              <div class="segment-card">
                <div class="segment-thumb"></div>
                <div class="segment-info">
                  <div class="segment-title">Viral Moment ${i}</div>
                  <div class="segment-meta">00:${10 * i} - 00:${10 * i + 15}</div>
                </div>
              </div>
            `)}
          </div>
        </aside>

        <!-- Center: Reel -->
        <main class="reel-container">
          <!-- Short Player Component -->
          <short-player src="demo.mp4" caption="Irens thelne vante huigre Stens.. in abet lhe voe tenid anger nap."></short-player>
        </main>

        <!-- Right: Tools -->
        <aside class="glass-panel sidebar-right">
          <div class="tools-header">
            <span style="font-weight:600; color:#f8fafc;">Audio</span>
            <button class="export-btn">Export</button>
          </div>
          
          <sl-tab-group>
            <sl-tab slot="nav" panel="captions">Captions</sl-tab>
            <sl-tab slot="nav" panel="style">Style</sl-tab>
            
            <sl-tab-panel name="captions">
               <div class="captions-list">
                 ${[1, 2, 3, 4, 5].map(i => html`
                    <div class="caption-item">
                        <sl-icon name="lock" style="color:#64748b; font-size: 14px;"></sl-icon>
                        <div class="caption-text">Caption line number ${i} text content...</div>
                        <div class="caption-time">00:${i * 5}</div>
                    </div>
                 `)}
               </div>
            </sl-tab-panel>
            
            <sl-tab-panel name="style">
               <div style="color:#94a3b8; font-size:13px; text-align:center; padding-top:20px;">
                  Style controls coming soon...
               </div>
            </sl-tab-panel>
          </sl-tab-group>
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
