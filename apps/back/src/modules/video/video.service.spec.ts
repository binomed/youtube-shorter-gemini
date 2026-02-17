// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { VideoService } from './video.service';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { ProgressService } from './progress.service';

// Use manual mock to avoid Jest ESM issues with @ffmpeg/ffmpeg
jest.mock('../../workers/ffmpeg.service');

describe('VideoService', () => {
    let service: VideoService;
    let ffmpegService: FFmpegService;
    let progressService: ProgressService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VideoService,
                {
                    provide: FFmpegService,
                    useValue: {
                        extractMetadata: jest.fn(),
                    },
                },
                {
                    provide: ProgressService,
                    useValue: {
                        emitProgress: jest.fn(),
                        emitError: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<VideoService>(VideoService);
        ffmpegService = module.get<FFmpegService>(FFmpegService);
        progressService = module.get<ProgressService>(ProgressService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createProject', () => {
        it('should create project with original file path and metadata', async () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'videoFile',
                originalname: 'test-video.mp4',
                encoding: '7bit',
                mimetype: 'video/mp4',
                buffer: Buffer.from('fake video data'),
                size: 1024,
                path: '/Users/test/Videos/my-video.mp4', // Original file path
            } as Express.Multer.File;

            const mockMetadata = {
                duration: 120.5,
                resolution: '1920x1080',
                codec: 'h264',
                width: 1920,
                height: 1080,
            };

            jest.spyOn(ffmpegService, 'extractMetadata').mockResolvedValue(
                mockMetadata,
            );

            const result = await service.createProject('Test Project', mockFile);

            // Verify project creation
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('name', 'Test Project');
            expect(result).toHaveProperty('videoPath', '/Users/test/Videos/my-video.mp4');
            expect(result).toHaveProperty('createdAt');

            // Verify metadata was extracted
            expect(result).toHaveProperty('duration', 120.5);
            expect(result).toHaveProperty('resolution', '1920x1080');
            expect(result).toHaveProperty('codec', 'h264');
            expect(ffmpegService.extractMetadata).toHaveBeenCalledWith('/Users/test/Videos/my-video.mp4');
        });

        it('should fallback to originalname if path is not available', async () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'videoFile',
                originalname: 'test-video.mp4',
                encoding: '7bit',
                mimetype: 'video/mp4',
                buffer: Buffer.from('fake video data'),
                size: 1024,
                // path is undefined
            } as Express.Multer.File;

            const result = await service.createProject('Test Project', mockFile);

            // Verify it uses originalname as fallback
            expect(result).toHaveProperty('videoPath', 'test-video.mp4');
        });
    });
});
