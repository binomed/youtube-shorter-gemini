/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { describe, it, expect } from 'vitest';
import { html } from 'lit';
import { fixture } from '@open-wc/testing-helpers';
import '../my-element';
import type { MyElement } from '../my-element';

describe('MyElement', (): void => {
    it('should render with default count', async (): Promise<void> => {
        const el = await fixture<MyElement>(html`<my-element></my-element>`);
        expect(el).toBeDefined();
        const shadowRoot = el.shadowRoot;
        expect(shadowRoot).not.toBeNull();
        if (shadowRoot) {
            const content = shadowRoot.textContent;
            expect(content).toContain('count is 0');
        }
    });

    it('should increment count when button is clicked', async (): Promise<void> => {
        const el = await fixture<MyElement>(html`<my-element></my-element>`);
        const button = el.shadowRoot?.querySelector('sl-button');
        expect(button).toBeDefined();

        if (button) {
            button.click();
            await el.updateComplete;
            const content = el.shadowRoot?.textContent;
            expect(content).toContain('count is 1');
        }
    });

    it('should have docsHint property', async (): Promise<void> => {
        const el = await fixture<MyElement>(html`<my-element></my-element>`);
        expect(el.docsHint).toBeDefined();
        expect(el.docsHint).toContain('Vite and Lit');
    });
});
