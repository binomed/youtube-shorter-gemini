/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { PROJECT_NAME } from '../src/index';

describe('Shared Package', () => {
    it('should export PROJECT_NAME constant', () => {
        expect(PROJECT_NAME).toBe('youtube-shorter-gemini');
    });

    it('should have a valid project name string', () => {
        expect(typeof PROJECT_NAME).toBe('string');
        expect(PROJECT_NAME.length).toBeGreaterThan(0);
    });
});
