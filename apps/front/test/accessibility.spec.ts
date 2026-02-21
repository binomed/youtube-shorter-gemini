/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { html } from 'lit';
import { fixture } from '@open-wc/testing-helpers';
import '../src/components/organisms/yts-project-form.element.js';
import type { YtsProjectForm } from '../src/components/organisms/yts-project-form.element.js';
import { projectService } from '../src/services/project.service.js';

vi.mock('axios');

/**
 * Accessibility tests for Lit components using basic checks
 * Tests WCAG 2.1 AA compliance requirements
 *
 * Note: Full axe-core testing requires a browser environment (Playwright)
 * This covers basic structural/semantic a11y validation in happy-dom.
 */
describe('Accessibility Tests', (): void => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.spyOn(projectService, 'getConfig').mockResolvedValue({
            maxVideoSizeMb: 500,
            allowedExtensions: ['.mp4', '.mov'],
            allowedMimeTypes: ['video/mp4', 'video/quicktime'],
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });
    it('project form should have accessible dropzone', async (): Promise<void> => {
        const el = await fixture<YtsProjectForm>(
            html`<yts-project-form></yts-project-form>`,
        );

        expect(el).toBeDefined();
        expect(el.shadowRoot).not.toBeNull();

        // Dropzone should be keyboard accessible
        const dropzone = el.shadowRoot?.querySelector('.dropzone');
        expect(dropzone?.getAttribute('role')).toBe('button');
        expect(dropzone?.getAttribute('tabindex')).toBe('0');
        expect(dropzone?.getAttribute('aria-label')).toBeTruthy();
    });

    it('project form should have labeled inputs', async (): Promise<void> => {
        const el = await fixture<YtsProjectForm>(
            html`<yts-project-form></yts-project-form>`,
        );

        // Name input should have a label
        const labels = el.shadowRoot?.querySelectorAll('label');
        expect(labels).toBeDefined();
        expect((labels as NodeListOf<HTMLElement>).length).toBeGreaterThan(0);
    });

    it('project form should have privacy notice with correct role', async (): Promise<void> => {
        const el = await fixture<YtsProjectForm>(
            html`<yts-project-form></yts-project-form>`,
        );

        const notice = el.shadowRoot?.querySelector('.privacy-notice');
        expect(notice?.getAttribute('role')).toBe('note');
        expect(notice?.getAttribute('aria-label')).toBe('Privacy notice');
    });
});
