// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { VideoService } from './video.service';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { Project } from '../../entities/project.entity';

// Use manual mock to avoid Jest ESM issues with @ffmpeg/ffmpeg
jest.mock('../../workers/ffmpeg.service');

describe('VideoService', () => {
    let service: VideoService;
    let ffmpegService: FFmpegService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                VideoService,
                {
                    provide: getRepositoryToken(Project),
                    useValue: {
                        create: jest.fn(),
                        save: jest.fn(),
                        find: jest.fn(),
                        findOne: jest.fn(),
                        delete: jest.fn(),
                    },
                },
                {
                    provide: FFmpegService,
                    useValue: {
                        extractMetadata: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get<VideoService>(VideoService);
        ffmpegService = module.get<FFmpegService>(FFmpegService);
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

            const mockProject = {
                id: 'generated-uuid-123',
                name: 'My Video Project',
                videoPath: '/Users/test/Videos/my-video.mp4',
                duration: 120.5,
                resolution: '1920x1080',
                codec: 'h264',
                createdAt: new Date(),
                updatedAt: new Date(),
            };

            jest.spyOn(ffmpegService, 'extractMetadata').mockResolvedValue(
                mockMetadata,
            );
            const projectRepository = service['projectRepository'];
            jest.spyOn(projectRepository, 'create').mockReturnValue(mockProject);
            jest.spyOn(projectRepository, 'save').mockResolvedValue(mockProject);

            const result = await service.createProject('My Video Project', mockFile);

            // Verify project creation
            expect(result).toEqual({
                id: 'generated-uuid-123',
                name: 'My Video Project',
                videoPath: '/Users/test/Videos/my-video.mp4',
                createdAt: mockProject.createdAt.toISOString(),
                duration: 120.5,
                resolution: '1920x1080',
                codec: 'h264',
            });
            expect(projectRepository.save).toHaveBeenCalledWith(mockProject);

            // Verify metadata was extracted
            expect(ffmpegService.extractMetadata).toHaveBeenCalledWith('/Users/test/Videos/my-video.mp4');
        });

    });
});
