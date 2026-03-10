// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { StemService } from './stem.service';
import { JobProgressService } from '../processing/job-progress.service';

const mockAnalysisService = {
  analyzeProject: jest.fn(),
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
});
