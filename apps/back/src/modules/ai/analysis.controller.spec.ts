// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { StemService } from './stem.service';
import { JobProgressService } from '../processing/job-progress.service';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import type { Response } from 'express';

const mockAnalysisService = {
  analyzeProject: jest.fn(),
  getShortsByProject: jest.fn(),
  updateShortCoverImage: jest.fn(),
  getCoverImagePath: jest.fn(),
  createShort: jest.fn(),
};

const mockStemService = {
  separateStems: jest.fn(),
};

const mockJobProgressService = {
  startJob: jest.fn().mockResolvedValue('job-123'),
  emit: jest.fn().mockResolvedValue(undefined),
  getStream: jest.fn(),
  complete: jest.fn().mockResolvedValue(undefined),
  fail: jest.fn().mockResolvedValue(undefined),
};

describe('AnalysisController', () => {
  let controller: AnalysisController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalysisController],
      providers: [
        { provide: AnalysisService, useValue: mockAnalysisService },
        { provide: StemService, useValue: mockStemService },
        { provide: JobProgressService, useValue: mockJobProgressService },
      ],
    }).compile();

    controller = module.get<AnalysisController>(AnalysisController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /projects/:projectId/analyze', () => {
    it('should trigger analysis and return projectId + jobId', async () => {
      mockAnalysisService.analyzeProject.mockResolvedValue([]);

      const result = await controller.analyzeProject('proj-1');

      expect(result).toEqual({
        projectId: 'proj-1',
        jobId: 'job-123',
      });
      expect(mockAnalysisService.analyzeProject).toHaveBeenCalledWith(
        'proj-1',
        'job-123',
      );
    });
  });

  describe('POST /projects/:projectId/shorts/:shortId/stems', () => {
    it('should trigger stem separation and return success + jobId', async () => {
      mockStemService.separateStems.mockResolvedValue({
        id: 'short-1',
        vocalsPath: '/tmp/vocals.wav',
      });

      const result = await controller.separateStems('proj-1', 'short-1');

      expect(result).toEqual({
        success: true,
        jobId: 'job-123',
      });
      expect(mockStemService.separateStems).toHaveBeenCalledWith(
        'proj-1',
        'short-1',
        'job-123',
      );
    });
  });

  describe('POST /projects/:projectId/shorts', () => {
    it('should call createShort on the service and return mapped response', async () => {
      const mockShort = {
        id: 's1',
        projectId: 'p1',
        title: 'Custom Short',
        startTime: 0,
        endTime: 30,
        subtitles: [],
        segments: [],
        createdAt: new Date(),
      };
      mockAnalysisService.createShort = jest.fn().mockResolvedValue(mockShort);

      const result = await controller.createShort('p1', {
        title: 'Custom Short',
        startTime: 0,
        endTime: 30,
      });

      expect(mockAnalysisService.createShort).toHaveBeenCalledWith('p1', {
        title: 'Custom Short',
        startTime: 0,
        endTime: 30,
      });
      expect(result.id).toBe('s1');
      expect(result.title).toBe('Custom Short');
    });
  });

  describe('Cover Image Endpoints', () => {
    const mockFile = {
      fieldname: 'cover',
      originalname: 'cover.jpg',
      encoding: '7bit',
      mimetype: 'image/jpeg',
      buffer: Buffer.from('test-image-content'),
      size: 18,
    } as unknown as Express.Multer.File;

    const testCoversDir = path.join(process.cwd(), 'uploads', 'covers');
    const testUploadPath = path.join(testCoversDir, 'short-upload-test.jpg');
    const testGetPath = path.join(testCoversDir, 'short-get-test.jpg');
    const testDeletePath = path.join(testCoversDir, 'short-delete-test.jpg');

    beforeEach(async () => {
      await fsPromises
        .rm(testCoversDir, { recursive: true, force: true })
        .catch(() => {});
      await fsPromises.mkdir(testCoversDir, { recursive: true });
    });

    afterAll(async () => {
      await fsPromises
        .rm(testCoversDir, { recursive: true, force: true })
        .catch(() => {});
    });

    describe('POST /projects/:id/shorts/:shortId/cover', () => {
      it('should upload cover image and return updated short', async () => {
        const mockShort = {
          id: 'short-upload-test',
          projectId: 'proj-1',
          title: 'Test',
          startTime: 0,
          endTime: 30,
          confidence: 90,
          orderIndex: 0,
          segments: [],
          coverImagePath: testUploadPath,
          createdAt: new Date(),
        };
        mockAnalysisService.getShortsByProject.mockResolvedValue([mockShort]);
        mockAnalysisService.updateShortCoverImage.mockResolvedValue(undefined);

        const result = await controller.uploadCoverImage(
          'proj-1',
          'short-upload-test',
          mockFile,
        );

        expect(fs.existsSync(testUploadPath)).toBe(true);
        expect(mockAnalysisService.updateShortCoverImage).toHaveBeenCalledWith(
          'proj-1',
          'short-upload-test',
          testUploadPath,
        );
        expect(result.coverImageUrl).toBe(
          '/api/projects/proj-1/shorts/short-upload-test/cover',
        );
      });

      it('should throw BadRequestException if no file provided', async () => {
        await expect(
          controller.uploadCoverImage(
            'proj-1',
            'short-1',
            null as unknown as Express.Multer.File,
          ),
        ).rejects.toThrow(BadRequestException);
      });

      it('should throw PayloadTooLargeException if file exceeds 5MB', async () => {
        const largeFile = {
          ...mockFile,
          size: 6 * 1024 * 1024,
        } as unknown as Express.Multer.File;
        await expect(
          controller.uploadCoverImage('proj-1', 'short-1', largeFile),
        ).rejects.toThrow(PayloadTooLargeException);
      });

      it('should throw NotFoundException if short not found', async () => {
        mockAnalysisService.getShortsByProject.mockResolvedValue([]);
        await expect(
          controller.uploadCoverImage('proj-1', 'nonexistent', mockFile),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('GET /projects/:id/shorts/:shortId/cover', () => {
      it('should stream cover image when file exists', async () => {
        await fsPromises.writeFile(testGetPath, 'fake-jpeg-data');
        mockAnalysisService.getCoverImagePath.mockResolvedValue(testGetPath);

        const setFn = jest.fn();
        const mockRes = { set: setFn } as unknown as Response;
        const streamableFile = await controller.getCoverImage(
          'proj-1',
          'short-get-test',
          mockRes,
        );

        expect(setFn).toHaveBeenCalledWith({
          'Content-Type': 'image/jpeg',
          'Content-Disposition': 'inline',
        });
        expect(streamableFile).toBeDefined();
        if (streamableFile && streamableFile.getStream()) {
          const stream = streamableFile.getStream() as fs.ReadStream;
          try {
            stream.destroy();
          } catch {
            // ignore
          }
        }
      });

      it('should throw NotFoundException when file does not exist on disk', async () => {
        mockAnalysisService.getCoverImagePath.mockResolvedValue(
          path.join(testCoversDir, 'nonexistent.jpg'),
        );

        const mockRes = { set: jest.fn() } as unknown as Response;
        await expect(
          controller.getCoverImage('proj-1', 'nonexistent', mockRes),
        ).rejects.toThrow(NotFoundException);
      });
    });

    describe('DELETE /projects/:id/shorts/:shortId/cover', () => {
      it('should delete cover image file and nullify column in DB', async () => {
        await fsPromises.writeFile(testDeletePath, 'fake-jpeg-data');
        const mockShort = {
          id: 'short-delete-test',
          projectId: 'proj-1',
          coverImagePath: testDeletePath,
        };
        mockAnalysisService.getShortsByProject.mockResolvedValue([mockShort]);
        mockAnalysisService.updateShortCoverImage.mockResolvedValue(undefined);

        expect(fs.existsSync(testDeletePath)).toBe(true);
        await controller.deleteCoverImage('proj-1', 'short-delete-test');

        expect(fs.existsSync(testDeletePath)).toBe(false);
        expect(mockAnalysisService.updateShortCoverImage).toHaveBeenCalledWith(
          'proj-1',
          'short-delete-test',
          null,
        );
      });

      it('should throw NotFoundException if short not found', async () => {
        mockAnalysisService.getShortsByProject.mockResolvedValue([]);
        await expect(
          controller.deleteCoverImage('proj-1', 'nonexistent'),
        ).rejects.toThrow(NotFoundException);
      });
    });
  });
});
