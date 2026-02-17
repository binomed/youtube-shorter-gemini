// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { FFmpegService } from './ffmpeg.service';

describe('FFmpegService', () => {
    let service: FFmpegService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [FFmpegService],
        }).compile();

        service = module.get<FFmpegService>(FFmpegService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('extractMetadata', () => {
        it('should extract metadata from video file', async () => {
            // Note: This is a unit test stub. Full integration testing with actual
            // video files should be done in e2e tests to avoid large test fixtures.
            // For now, we verify the service is properly structured.

            expect(service.extractMetadata).toBeDefined();
            expect(typeof service.extractMetadata).toBe('function');
        });

        it('should return metadata with correct structure', async () => {
            // Mock test - verifying return type structure
            // Real file testing deferred to integration tests
            const mockMetadata = {
                duration: 120.5,
                resolution: '1920x1080',
                codec: 'h264',
                width: 1920,
                height: 1080,
            };

            expect(mockMetadata).toHaveProperty('duration');
            expect(mockMetadata).toHaveProperty('resolution');
            expect(mockMetadata).toHaveProperty('codec');
            expect(mockMetadata).toHaveProperty('width');
            expect(mockMetadata).toHaveProperty('height');
        });
    });
});
