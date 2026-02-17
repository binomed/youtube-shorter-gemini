// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { CreateProjectDto } from '@youtube-shorter/shared';

// Use manual mock to avoid Jest ESM issues with @ffmpeg/ffmpeg
jest.mock('../../workers/ffmpeg.service');

describe('VideoController', () => {
    let controller: VideoController;
    let service: VideoService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [VideoController],
            providers: [
                {
                    provide: VideoService,
                    useValue: {
                        createProject: jest.fn(),
                    },
                },
                {
                    provide: ConfigService,
                    useValue: {
                        get: jest.fn((key: string, defaultValue: any) => defaultValue),
                    },
                },
            ],
        }).compile();

        controller = module.get<VideoController>(VideoController);
        service = module.get<VideoService>(VideoService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('createProject', () => {
        const mockCreateProjectDto: CreateProjectDto = {
            name: 'Test Project',
        };

        const mockFile: Express.Multer.File = {
            fieldname: 'videoFile',
            originalname: 'test-video.mp4',
            encoding: '7bit',
            mimetype: 'video/mp4',
            buffer: Buffer.from('fake video data'),
            size: 10 * 1024 * 1024, // 10MB
        } as Express.Multer.File;

        it('should create project with valid MP4 file', async () => {
            const mockProject = {
                id: '123',
                name: 'Test Project',
                videoPath: '/tmp/youtube-shorter/uploads/123/test-video.mp4',
                createdAt: new Date().toISOString(),
            };

            jest.spyOn(service, 'createProject').mockResolvedValue(mockProject);

            const result = await controller.createProject(
                mockCreateProjectDto,
                mockFile,
            );

            expect(result).toEqual({
                success: true,
                data: mockProject,
            });
            expect(service.createProject).toHaveBeenCalledWith(
                'Test Project',
                mockFile,
            );
        });

        it('should accept MOV files', async () => {
            const movFile: Express.Multer.File = {
                ...mockFile,
                mimetype: 'video/quicktime',
                originalname: 'test-video.mov',
            };

            const mockProject = {
                id: '123',
                name: 'Test Project',
                videoPath: '/tmp/youtube-shorter/uploads/123/test-video.mov',
                createdAt: new Date().toISOString(),
            };

            jest.spyOn(service, 'createProject').mockResolvedValue(mockProject);

            const result = await controller.createProject(
                mockCreateProjectDto,
                movFile,
            );

            expect(result.success).toBe(true);
        });

        it('should throw error if no file provided', async () => {
            await expect(
                controller.createProject(mockCreateProjectDto, undefined),
            ).rejects.toThrow(
                new HttpException('Video file is required', HttpStatus.BAD_REQUEST),
            );
        });

        it('should reject invalid file format', async () => {
            const invalidFile: Express.Multer.File = {
                ...mockFile,
                mimetype: 'video/avi',
            };

            await expect(
                controller.createProject(mockCreateProjectDto, invalidFile),
            ).rejects.toThrow(
                new HttpException(
                    'Invalid file format. Only MP4 and MOV files are accepted.',
                    HttpStatus.BAD_REQUEST,
                ),
            );
        });

        it('should reject files exceeding size limit', async () => {
            const largeFile: Express.Multer.File = {
                ...mockFile,
                size: 3 * 1024 * 1024 * 1024, // 3GB (exceeds 2GB limit)
            };

            await expect(
                controller.createProject(mockCreateProjectDto, largeFile),
            ).rejects.toThrow(
                new HttpException(
                    'File size exceeds the maximum limit of 2048MB.',
                    HttpStatus.BAD_REQUEST,
                ),
            );
        });
    });
});
