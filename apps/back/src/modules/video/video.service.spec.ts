// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { VideoService } from './video.service';

describe('VideoService', () => {
    let service: VideoService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [VideoService],
        }).compile();

        service = module.get<VideoService>(VideoService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('createProject', () => {
        it('should create project with original file path', async () => {
            const mockFile: Express.Multer.File = {
                fieldname: 'videoFile',
                originalname: 'test-video.mp4',
                encoding: '7bit',
                mimetype: 'video/mp4',
                buffer: Buffer.from('fake video data'),
                size: 1024,
                path: '/Users/test/Videos/my-video.mp4', // Original file path
            } as Express.Multer.File;

            const result = await service.createProject('Test Project', mockFile);

            // Verify project creation
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('name', 'Test Project');
            expect(result).toHaveProperty('videoPath', '/Users/test/Videos/my-video.mp4');
            expect(result).toHaveProperty('createdAt');
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
