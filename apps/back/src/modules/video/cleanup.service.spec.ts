// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { CleanupService } from './cleanup.service';
import { Project } from '../../entities/project.entity';
import { Short } from '../../entities/short.entity';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises to avoid real file operations in tests
jest.mock('fs/promises');

describe('CleanupService', () => {
  let service: CleanupService;
  let mockDataSource: { transaction: jest.Mock };
  let mockProjectRepository: Record<string, jest.Mock>;
  let mockShortRepository: Record<string, jest.Mock>;

  const uploadsDir = path.resolve(process.cwd(), 'uploads');

  // Helper to build a mock transaction manager
  const buildMockManager = (
    projectOverride?: Partial<Project>,
    shorts: Partial<Short>[] = [],
  ): { getRepository: jest.Mock } => {
    const mockProject: Partial<Project> = {
      id: 'test-project-123',
      name: 'Test Project',
      videoPath: path.join(uploadsDir, 'abc123-multer-file.mp4'),
      ...projectOverride,
    };

    mockProjectRepository = {
      findOne: jest.fn().mockResolvedValue(mockProject),
      find: jest.fn().mockResolvedValue(shorts),
      remove: jest.fn().mockResolvedValue(mockProject),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    mockShortRepository = {
      find: jest.fn().mockResolvedValue(shorts),
    };

    return {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === Project) return mockProjectRepository;
        if (entity === Short) return mockShortRepository;
        return mockProjectRepository;
      }),
    };
  };

  const createService = (
    projectOverride?: Partial<Project>,
    shorts: Partial<Short>[] = [],
  ) => {
    const mockManager = buildMockManager(projectOverride, shorts);
    mockDataSource = {
      transaction: jest.fn((callback: (manager: EntityManager) => unknown) => {
        return callback(mockManager as unknown as EntityManager);
      }),
    };
  };

  beforeEach(() => {
    createService();
    jest.clearAllMocks();
    (fs.unlink as jest.Mock).mockResolvedValue(undefined);
    (fs.rm as jest.Mock).mockResolvedValue(undefined);
  });

  const buildModule = async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
  };

  it('should be defined', async () => {
    await buildModule();
    expect(service).toBeDefined();
  });

  describe('deleteProject', () => {
    it('should delete project by ID', async () => {
      await buildModule();
      await expect(
        service.deleteProject('test-project-123'),
      ).resolves.not.toThrow();
      expect(mockProjectRepository.remove).toHaveBeenCalled();
    });

    it('should throw NotFoundException if project does not exist', async () => {
      createService();
      mockProjectRepository = {
        ...mockProjectRepository,
        findOne: jest.fn().mockResolvedValue(null),
      };
      // Rebuild dataSource with the overridden repo
      const mockManager = {
        getRepository: jest.fn(() => mockProjectRepository),
      };
      mockDataSource = {
        transaction: jest.fn((callback: (manager: EntityManager) => unknown) =>
          callback(mockManager as unknown as EntityManager),
        ),
      };
      await buildModule();
      await expect(service.deleteProject('missing-id')).rejects.toThrow(
        NotFoundException,
      );
    });

    describe('upload file cleanup (AC-1)', () => {
      it('should delete the uploaded video file when videoPath is inside ./uploads/', async () => {
        const videoPath = path.join(uploadsDir, 'abc123-multer-file.mp4');
        createService({ videoPath });
        await buildModule();

        await service.deleteProject('test-project-123');

        expect(fs.unlink).toHaveBeenCalledWith(videoPath);
      });

      it('should NOT delete the video file when videoPath is outside ./uploads/ (user original file)', async () => {
        const videoPath = '/Users/jef/Videos/my-original-video.mp4';
        createService({ videoPath });
        await buildModule();

        await service.deleteProject('test-project-123');

        // fs.unlink should not be called for user's original file
        // (It may be called for thumbnails, but not for the videoPath)
        const unlinkCalls = (fs.unlink as jest.Mock).mock.calls as string[][];
        const calledWithVideoPath = unlinkCalls.some(
          (args) => args[0] === videoPath,
        );
        expect(calledWithVideoPath).toBe(false);
      });

      it('should be fail-safe: if upload file deletion fails, project DB record is still deleted (AC-4)', async () => {
        const videoPath = path.join(uploadsDir, 'already-deleted.mp4');
        createService({ videoPath });
        await buildModule();

        (fs.unlink as jest.Mock).mockRejectedValueOnce(
          new Error('ENOENT: no such file or directory'),
        );

        // Should NOT throw, even if fs.unlink fails
        await expect(
          service.deleteProject('test-project-123'),
        ).resolves.not.toThrow();
        // DB record should still be removed
        expect(mockProjectRepository.remove).toHaveBeenCalled();
      });
    });

    describe('stem files cleanup (AC-2)', () => {
      it('should delete the stems directory for each Short', async () => {
        const short: Partial<Short> = {
          id: 'short-abc',
          projectId: 'test-project-123',
        };
        createService(undefined, [short]);
        await buildModule();

        await service.deleteProject('test-project-123');

        const expectedStemsDir = path.join(
          process.cwd(),
          'uploads',
          'stems',
          'short-abc',
        );

        expect(fs.rm).toHaveBeenCalledWith(expectedStemsDir, {
          recursive: true,
          force: true,
        });
      });

      it('should delete vocalsPath and accompanimentPath from DB record (AC-2)', async () => {
        const short: Partial<Short> = {
          id: 'short-abc',
          projectId: 'test-project-123',
          vocalsPath: '/path/to/vocals.wav',
          accompanimentPath: '/path/to/accompaniment.wav',
        };
        createService(undefined, [short]);
        await buildModule();

        await service.deleteProject('test-project-123');

        expect(fs.unlink).toHaveBeenCalledWith('/path/to/vocals.wav');

        expect(fs.unlink).toHaveBeenCalledWith('/path/to/accompaniment.wav');
      });
    });

    describe('thumbnail cleanup (AC-3)', () => {
      it('should delete thumbnails from each Short', async () => {
        const short: Partial<Short> = {
          id: 'short-abc',
          projectId: 'test-project-123',
          thumbnailPath: '/uploads/thumbnails/short-abc.jpg',
        };
        createService(undefined, [short]);
        await buildModule();

        await service.deleteProject('test-project-123');

        expect(fs.unlink).toHaveBeenCalledWith(
          '/uploads/thumbnails/short-abc.jpg',
        );
      });
    });
  });

  describe('deleteAllProjects', () => {
    it('should delete all projects', async () => {
      createService();
      await buildModule();
      await expect(service.deleteAllProjects()).resolves.not.toThrow();
    });
  });

  describe('cleanupInactive', () => {
    it('should cleanup inactive projects', async () => {
      createService();
      await buildModule();
      const maxAgeHours = 24;
      await expect(service.cleanupInactive(maxAgeHours)).resolves.not.toThrow();
    });
  });
});
