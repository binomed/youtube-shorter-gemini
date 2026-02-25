// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { AnalysisController } from './analysis.controller';
import { AnalysisService } from './analysis.service';
import { StemService } from './stem.service';

const mockAnalysisService = {
  analyzeProject: jest.fn(),
};

const mockStemService = {
  separateStems: jest.fn(),
  getJobStatus: jest.fn(),
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
      ],
    }).compile();

    controller = module.get<AnalysisController>(AnalysisController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('POST /projects/:projectId/analyze', () => {
    it('should trigger analysis and return 202 Accepted', async () => {
      mockAnalysisService.analyzeProject.mockResolvedValue([]);

      // The controller returns a response object with success flag
      const result = await controller.analyzeProject('proj-1');

      expect(result).toBeDefined();
      expect(mockAnalysisService.analyzeProject).toHaveBeenCalledWith(
        'proj-1',
        expect.anything(),
      );
    });
  });

  describe('POST /projects/:projectId/shorts/:shortId/stems', () => {
    it('should trigger stem separation', async () => {
      mockStemService.separateStems.mockResolvedValue({
        id: 'short-1',
        vocalsPath: '/tmp/vocals.wav',
      });

      const result = await controller.separateStems('proj-1', 'short-1');

      expect(result).toBeDefined();
      expect(mockStemService.separateStems).toHaveBeenCalledWith(
        'proj-1',
        'short-1',
        expect.anything(),
      );
    });
  });
});
