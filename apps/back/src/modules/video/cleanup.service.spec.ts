// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CleanupService } from './cleanup.service';
import { Project } from '../../entities/project.entity';

describe('CleanupService', () => {
  let service: CleanupService;
  let mockDataSource: any;
  let mockRepository: any;

  beforeEach(async () => {
    // Mock project for successful deletion
    const mockProject = {
      id: 'test-project-123',
      name: 'Test Project',
      videoPath: '/Users/test/video.mp4',
    };

    mockRepository = {
      findOne: jest.fn().mockResolvedValue(mockProject),
      remove: jest.fn().mockResolvedValue(mockProject),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };

    // Mock DataSource for transactions
    mockDataSource = {
      transaction: jest.fn((callback) => {
        // Execute transaction callback with mock manager
        const mockManager = {
          getRepository: jest.fn().mockReturnValue(mockRepository),
        };
        return callback(mockManager);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanupService,
        {
          provide: getRepositoryToken(Project),
          useValue: mockRepository,
        },
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
      ],
    }).compile();

    service = module.get<CleanupService>(CleanupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('deleteProject', () => {
    it('should delete project by ID', async () => {
      const projectId = 'test-project-123';

      // TODO: Add expectations when TypeORM repository is available
      // For now, just verify it doesn't throw
      await expect(service.deleteProject(projectId)).resolves.not.toThrow();
    });
  });

  describe('deleteAllProjects', () => {
    it('should delete all projects', async () => {
      // TODO: Add expectations when TypeORM repository is available
      await expect(service.deleteAllProjects()).resolves.not.toThrow();
    });
  });

  describe('cleanupInactive', () => {
    it('should cleanup inactive projects (no-op for Story 1.1)', async () => {
      const maxAgeHours = 24;

      // Story 1.1: This is a no-op, verify it doesn't throw
      await expect(service.cleanupInactive(maxAgeHours)).resolves.not.toThrow();
    });
  });
});
