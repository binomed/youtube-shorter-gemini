// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import { NotFoundException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { GeminiService } from './gemini.service';
import { WhisperService } from './whisper.service';
import { StemService } from './stem.service';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { JobProgressService } from '../processing/job-progress.service';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import { Subtitle } from '../../entities/subtitle.entity';
// Mock child_process so spawn returns a fake EventEmitter that immediately exits with code 0
jest.mock('child_process', () => ({
  spawn: jest.fn(() => {
    const proc = new EventEmitter() as NodeJS.EventEmitter & {
      stderr: EventEmitter;
    };
    proc.stderr = new EventEmitter();
    setImmediate(() => proc.emit('close', 0));
    return proc;
  }),
}));

// Mock fs/promises so mkdir/unlink don't touch real disk
jest.mock('fs/promises', () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  rm: jest.fn().mockResolvedValue(undefined),
  unlink: jest.fn().mockResolvedValue(undefined),
  readFile: jest.fn().mockResolvedValue(Buffer.from('fake-frame')),
  readdir: jest.fn().mockResolvedValue([]),
}));

const mockProject = {
  id: 'proj-1',
  name: 'Test Project',
  videoPath: '/tmp/test.mp4',
  createdAt: new Date(),
};

const mockGeminiService = {
  detectShortsCandidates: jest.fn(),
};

const mockWhisperService = {
  generateSubtitles: jest.fn(),
};

const mockFfmpegService = {
  extractMetadata: jest.fn(),
  extractThumbnail: jest.fn(),
  extractAudio: jest.fn(),
};

const mockProjectRepository = {
  findOne: jest.fn(),
  findOneBy: jest.fn(),
};

const mockShortRepository = {
  create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
  save: jest.fn(),
  find: jest.fn(),
  delete: jest.fn(),
  findOneBy: jest.fn(),
};

const mockSubtitleRepository = {
  create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
  save: jest.fn(),
};

const mockJobProgressService = {
  emit: jest.fn().mockResolvedValue(undefined),
  complete: jest.fn().mockResolvedValue(undefined),
  fail: jest.fn().mockResolvedValue(undefined),
};

describe('AnalysisService', () => {
  let service: AnalysisService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalysisService,
        { provide: GeminiService, useValue: mockGeminiService },
        { provide: WhisperService, useValue: mockWhisperService },
        { provide: FFmpegService, useValue: mockFfmpegService },
        { provide: StemService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'TEMP_DIR' ? '/tmp' : undefined,
            ),
          },
        },
        { provide: getRepositoryToken(Short), useValue: mockShortRepository },
        {
          provide: getRepositoryToken(Project),
          useValue: mockProjectRepository,
        },
        {
          provide: getRepositoryToken(Subtitle),
          useValue: mockSubtitleRepository,
        },
        { provide: JobProgressService, useValue: mockJobProgressService },
      ],
    }).compile();

    service = module.get<AnalysisService>(AnalysisService);
  });

  describe('analyzeProject', () => {
    it('should throw NotFoundException when project does not exist', async () => {
      mockProjectRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.analyzeProject('nonexistent', 'job-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should call GeminiService and save resulting shorts', async () => {
      mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
      mockFfmpegService.extractMetadata.mockResolvedValue({
        duration: 120,
        width: 1920,
        height: 1080,
        codec: 'h264',
        resolution: '1920x1080',
      });
      mockGeminiService.detectShortsCandidates.mockResolvedValue([
        {
          title: 'Best moment',
          startTime: 10,
          endTime: 40,
          score: 0.9,
          reasoning: 'High energy',
        },
      ]);
      mockFfmpegService.extractThumbnail.mockResolvedValue(undefined);
      mockShortRepository.save.mockImplementation(
        (s: Record<string, unknown>) =>
          ({
            ...s,
            id: 'short-1',
          }) as Record<string, unknown>,
      );
      mockFfmpegService.extractAudio.mockResolvedValue(undefined);
      mockWhisperService.generateSubtitles.mockResolvedValue(null);

      const result = await service.analyzeProject('proj-1', 'job-1');

      expect(mockGeminiService.detectShortsCandidates).toHaveBeenCalled();
      expect(mockShortRepository.save).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });

    it('should emit SSE progress events when Subject is provided', async () => {
      mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
      mockFfmpegService.extractMetadata.mockResolvedValue({
        duration: 60,
        width: 1280,
        height: 720,
        codec: 'h264',
        resolution: '1280x720',
      });
      mockGeminiService.detectShortsCandidates.mockResolvedValue([]);
      mockFfmpegService.extractAudio.mockResolvedValue(undefined);
      mockWhisperService.generateSubtitles.mockResolvedValue(null);

      await service.analyzeProject('proj-1', 'job-1');

      expect(mockJobProgressService.emit).toHaveBeenCalled();
    });

    it('should continue analysis even if transcription fails', async () => {
      mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
      mockFfmpegService.extractMetadata.mockResolvedValue({
        duration: 60,
        width: 1280,
        height: 720,
        codec: 'h264',
        resolution: '1280x720',
      });
      mockGeminiService.detectShortsCandidates.mockResolvedValue([]);
      // extractAudio fails → transcription should be skipped, not crash
      mockFfmpegService.extractAudio.mockRejectedValue(
        new Error('ffmpeg not found'),
      );
      mockWhisperService.generateSubtitles.mockRejectedValue(
        new Error('API error'),
      );

      // Should NOT throw — transcription failure is non-fatal
      await expect(
        service.analyzeProject('proj-1', 'job-1'),
      ).resolves.toBeDefined();
    });
  });
});
