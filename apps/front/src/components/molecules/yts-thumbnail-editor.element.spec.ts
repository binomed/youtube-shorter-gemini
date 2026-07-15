import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fixture, html, oneEvent } from '@open-wc/testing-helpers';

vi.mock('@shoelace-style/shoelace/dist/components/dialog/dialog.js', () => {
  class MockSlDialog extends HTMLElement {
    show = vi.fn();
    hide = vi.fn();
  }
  if (!customElements.get('sl-dialog')) {
    customElements.define('sl-dialog', MockSlDialog);
  }
  return { default: MockSlDialog };
});

// Mock canvas methods for happy-dom environment
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
  clearRect: vi.fn(),
  drawImage: vi.fn(),
});

import { YtsThumbnailEditor } from './yts-thumbnail-editor.element.js';
import './yts-thumbnail-editor.element.js';

type YtsThumbnailEditorInternal = {
  loadImage(file: File): void;
  image: { width: number; height: number } | HTMLImageElement | null;
  imageLoaded: boolean;
};

describe('YtsThumbnailEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without errors', async () => {
    const el = await fixture<YtsThumbnailEditor>(html`
      <yts-thumbnail-editor projectId="p1" shortId="s1"></yts-thumbnail-editor>
    `);
    expect(el).toBeTruthy();
    expect(el.projectId).toBe('p1');
    expect(el.shortId).toBe('s1');
  });

  it('triggers image load when file is selected', async () => {
    const el = await fixture<YtsThumbnailEditor>(html`
      <yts-thumbnail-editor></yts-thumbnail-editor>
    `);
    
    const loadImageSpy = vi.spyOn(el as unknown as YtsThumbnailEditorInternal, 'loadImage');
    const fileInput = el.shadowRoot?.querySelector('#file-input') as HTMLInputElement;
    expect(fileInput).toBeTruthy();

    const file = new File(['dummy content'], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(fileInput, 'files', {
      value: [file],
      writable: false,
    });

    fileInput.dispatchEvent(new Event('change'));
    expect(loadImageSpy).toHaveBeenCalledWith(file);
  });

  it('emits cover-removed when remove button is clicked', async () => {
    const el = await fixture<YtsThumbnailEditor>(html`
      <yts-thumbnail-editor hasCover></yts-thumbnail-editor>
    `);

    const buttons = Array.from(el.shadowRoot?.querySelectorAll('sl-button') || []);
    const removeBtn = buttons.find(b => b.textContent?.includes('Remove Cover'));
    expect(removeBtn).toBeTruthy();

    setTimeout(() => removeBtn?.click());
    const event = await oneEvent(el, 'cover-removed');
    expect(event).toBeTruthy();
  });

  it('closes dialog on cancel button click without emitting events', async () => {
    const el = await fixture<YtsThumbnailEditor>(html`
      <yts-thumbnail-editor></yts-thumbnail-editor>
    `);

    const hideSpy = vi.spyOn(el, 'hide');
    const saveListener = vi.fn();
    const removeListener = vi.fn();
    el.addEventListener('cover-saved', saveListener);
    el.addEventListener('cover-removed', removeListener);

    const buttons = Array.from(el.shadowRoot?.querySelectorAll('sl-button') || []);
    const cancelBtn = buttons.find(b => b.textContent?.includes('Cancel'));
    expect(cancelBtn).toBeTruthy();

    cancelBtn?.click();
    expect(hideSpy).toHaveBeenCalled();
    expect(saveListener).not.toHaveBeenCalled();
    expect(removeListener).not.toHaveBeenCalled();
  });

  it('emits cover-saved with blob when save button is clicked after image load', async () => {
    const el = await fixture<YtsThumbnailEditor>(html`
      <yts-thumbnail-editor></yts-thumbnail-editor>
    `);

    // Simulate loaded image state
    const internalEl = el as unknown as YtsThumbnailEditorInternal;
    internalEl.image = { width: 100, height: 100 };
    internalEl.imageLoaded = true;
    await el.updateComplete;

    const fakeBlob = new Blob(['image-data'], { type: 'image/jpeg' });
    HTMLCanvasElement.prototype.toBlob = vi.fn().mockImplementation(function(callback) {
      callback(fakeBlob);
    });

    const buttons = Array.from(el.shadowRoot?.querySelectorAll('sl-button') || []);
    const saveBtn = buttons.find(b => b.textContent?.includes('Save Cover'));
    expect(saveBtn).toBeTruthy();

    setTimeout(() => saveBtn?.click());
    const event = await oneEvent(el, 'cover-saved');
    expect(event).toBeTruthy();
    expect((event as CustomEvent).detail.blob).toBe(fakeBlob);
  });
});
