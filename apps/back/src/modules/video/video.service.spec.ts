// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { VideoService } from './video.service';
import { FFmpegService, VideoMetadata } from '../../workers/ffmpeg.service';
import { Project } from '../../entities/project.entity';
import { CleanupService } from './cleanup.service';

// Use manual mock to avoid Jest ESM issues with @ffmpeg/ffmpeg
jest.mock('../../workers/ffmpeg.service');

// Mock file validation to avoid failing on dummy mock file paths
jest.mock('../../utils/file-validation', () => {
  const actual = jest.requireActual<Record<string, unknown>>(
    '../../utils/file-validation',
  );
  return {
    ...actual,
    validateFileSignature: jest.fn().mockResolvedValue(true),
  };
});

describe('VideoService', () => {
  let service: VideoService;
  let ffmpegService: FFmpegService;
  let projectRepository: Repository<Project>;
  let module: TestingModule;

  const mockFile = {
    fieldname: 'videoFile',
    originalname: 'test-video.mp4',
    encoding: '7bit',
    mimetype: 'video/mp4',
    buffer: Buffer.from('fake video data'),
    size: 1024,
    path: '/Users/test/Videos/my-video.mp4',
  } as Express.Multer.File;

  const mockCreateProjectDto = {
    name: 'My Video Project',
    deletionPolicyAcknowledged: true,
    aiLearningConsent: false,
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
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
            findOneBy: jest.fn(),
          },
        },
        {
          provide: FFmpegService,
          useValue: {
            extractMetadata: jest.fn(),
          },
        },
        {
          provide: CleanupService,
          useValue: {
            deleteProject: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VideoService>(VideoService);
    ffmpegService = module.get<FFmpegService>(FFmpegService);
    projectRepository = module.get<Repository<Project>>(
      getRepositoryToken(Project),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createProject', () => {
    it('should create project with original file path and metadata', async () => {
      const mockMetadata: VideoMetadata = {
        duration: 120.5,
        resolution: '1920x1080',
        codec: 'h264',
        width: 1920,
        height: 1080,
      };

      const mockProject: Project = {
        id: 'generated-uuid-123',
        name: 'My Video Project',
        description: 'Test description',
        videoPath: '/Users/test/Videos/my-video.mp4',
        duration: 120.5,
        resolution: '1920x1080',
        codec: 'h264',
        deletionPolicyAcknowledged: true,
        aiLearningConsent: false,
        isExported: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Project;

      jest
        .spyOn(ffmpegService, 'extractMetadata')
        .mockResolvedValue(mockMetadata);
      (projectRepository.create as jest.Mock).mockReturnValue(mockProject);
      (projectRepository.save as jest.Mock).mockResolvedValue(mockProject);

      const result = await service.createProject(
        mockCreateProjectDto,
        mockFile,
      );

      expect(result).toEqual({
        id: 'generated-uuid-123',
        name: 'My Video Project',
        videoPath: '/Users/test/Videos/my-video.mp4',
        createdAt: mockProject.createdAt.toISOString(),
        duration: 120.5,
        resolution: '1920x1080',
        codec: 'h264',
        deletionPolicyAcknowledged: true,
        aiLearningConsent: false,
        isExported: false,
        isAnalyzed: false,
      });

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(projectRepository.save).toHaveBeenCalledWith(mockProject);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(ffmpegService.extractMetadata).toHaveBeenCalledWith(
        '/Users/test/Videos/my-video.mp4',
      );
    });

    it('should throw BadRequestException if metadata extraction fails', async () => {
      jest
        .spyOn(ffmpegService, 'extractMetadata')
        .mockRejectedValue(new Error('FFmpeg error'));

      await expect(
        service.createProject(mockCreateProjectDto, mockFile),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException if DB save fails', async () => {
      const mockMetadata: VideoMetadata = {
        duration: 120.5,
        resolution: '1920x1080',
        codec: 'h264',
        width: 10,
        height: 10,
      };
      const mockProject: Project = {
        id: '123',
        name: 'test',
        videoPath: 'test.mp4',
        duration: 10,
        resolution: '10x10',
        codec: 'test',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Project;

      jest
        .spyOn(ffmpegService, 'extractMetadata')
        .mockResolvedValue(mockMetadata);
      (projectRepository.create as jest.Mock).mockReturnValue(mockProject);
      (projectRepository.save as jest.Mock).mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        service.createProject(mockCreateProjectDto, mockFile),
      ).rejects.toThrow();
    });
  });
});
