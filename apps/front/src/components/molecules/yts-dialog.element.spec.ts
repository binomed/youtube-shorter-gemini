import { describe, it, expect, vi } from 'vitest';
import { fixture, html } from '@open-wc/testing-helpers';

// Mock Shoelace component to avoid registration issues in happy-dom environment
vi.mock('@shoelace-style/shoelace/dist/components/dialog/dialog.js', () => ({
  default: class MockSlDialog extends HTMLElement {
    show = vi.fn();
    hide = vi.fn();
  }
}));

import { YtsDialog } from './yts-dialog.element.js';
import './yts-dialog.element.js';

describe('YtsDialog', () => {
  it('renders with default properties', async () => {
    const el = await fixture<YtsDialog>(html`
      <yts-dialog label="Test Dialog">Content</yts-dialog>
    `);

    expect(el.label).toBe('Test Dialog');
    expect(el.open).toBe(false);
  });

  it('renders the internal sl-dialog with correct properties', async () => {
    const el = await fixture<YtsDialog>(html`
      <yts-dialog label="Header" open>Content</yts-dialog>
    `);

    const slDialog = el.shadowRoot?.querySelector('sl-dialog');
    expect(slDialog).toBeTruthy();
    expect(slDialog?.getAttribute('label')).toBe('Header');
    expect(slDialog?.hasAttribute('open')).toBe(true);
  });

  it('renders slots correctly', async () => {
    const el = await fixture<YtsDialog>(html`
      <yts-dialog open>
        <div class="test-content">Main Content</div>
        <button slot="footer">Confirm</button>
      </yts-dialog>
    `);

    const contentSlot = el.shadowRoot?.querySelector('slot:not([name])');
    const footerSlot = el.shadowRoot?.querySelector('slot[name="footer"]');
    
    expect(contentSlot).toBeTruthy();
    expect(footerSlot).toBeTruthy();
  });
});
