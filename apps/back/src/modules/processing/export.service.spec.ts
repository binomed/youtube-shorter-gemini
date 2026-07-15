// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExportService } from './export.service';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { JobService } from './job.service';
import { JobProgressService } from './job-progress.service';
import type { SubtitleResponse } from '@youtube-shorter/shared';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import * as path from 'path';

describe('ExportService', () => {
  let service: ExportService;
  let mockShortRepo: Record<string, jest.Mock>;
  let mockProjectRepo: Record<string, jest.Mock>;
  let mockFFmpegService: Record<string, jest.Mock>;
  let mockJobProgressService: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockShortRepo = {
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    mockProjectRepo = {
      findOneBy: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    mockFFmpegService = {
      extractSegment: jest.fn().mockResolvedValue(undefined),
      extractMetadata: jest.fn().mockResolvedValue({ framerate: 30 }),
      createCoverFrameSegment: jest.fn().mockResolvedValue(undefined),
      concatenateAndRenderVertical: jest.fn().mockResolvedValue(undefined),
    };
    mockJobProgressService = { emit: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExportService,
        { provide: getRepositoryToken(Short), useValue: mockShortRepo },
        { provide: getRepositoryToken(Project), useValue: mockProjectRepo },
        { provide: FFmpegService, useValue: mockFFmpegService },
        { provide: JobService, useValue: {} },
        { provide: JobProgressService, useValue: mockJobProgressService },
      ],
    }).compile();

    service = module.get<ExportService>(ExportService);
  });

  // -------------------------------------------------------------------------
  // adjustSubtitleTimestamps — core unit tests
  // -------------------------------------------------------------------------
  describe('adjustSubtitleTimestamps', () => {
    const makeSub = (
      id: string,
      startTime: number,
      endTime: number,
      text = 'hello',
    ): SubtitleResponse => ({
      id,
      shortId: 'short-1',
      startTime,
      endTime,
      text,
    });

    it('should remap subtitles from a single segment with no offset', () => {
      const subs = [makeSub('s1', 2, 4)];
      const segments = [{ startTime: 0, endTime: 10 }];

      const result = service.adjustSubtitleTimestamps(subs, segments);

      expect(result).toHaveLength(1);
      expect(result[0].startTime).toBeCloseTo(2);
      expect(result[0].endTime).toBeCloseTo(4);
    });

    it('should remap subtitles and subtract the segment startTime offset', () => {
      // Segment starts at 30s in the source video
      const subs = [makeSub('s1', 32, 35)];
      const segments = [{ startTime: 30, endTime: 40 }];

      const result = service.adjustSubtitleTimestamps(subs, segments);

      expect(result).toHaveLength(1);
      expect(result[0].startTime).toBeCloseTo(2); // 32 - 30
      expect(result[0].endTime).toBeCloseTo(5); // 35 - 30
    });

    it('should accumulate offsets correctly across multiple segments', () => {
      // Segment 1: [10s → 15s] (5s long) → output [0s → 5s]
      // Segment 2: [20s → 25s] (5s long) → output [5s → 10s]
      const subs = [
        makeSub('s1', 11, 13), // in segment 1
        makeSub('s2', 21, 24), // in segment 2
      ];
      const segments = [
        { startTime: 10, endTime: 15 },
        { startTime: 20, endTime: 25 },
      ];

      const result = service.adjustSubtitleTimestamps(subs, segments);

      expect(result).toHaveLength(2);
      expect(result[0].startTime).toBeCloseTo(1); // 11 - 10
      expect(result[0].endTime).toBeCloseTo(3); // 13 - 10
      expect(result[1].startTime).toBeCloseTo(6); // 5 + (21 - 20)
      expect(result[1].endTime).toBeCloseTo(9); // 5 + (24 - 20)
    });

    // -----------------------------------------------------------------------
    // REGRESSION: camera-pan subtitle doubling bug
    // When centerX changes at t=5s inside a [2s→10s] segment, the segment is
    // internally split into sub-segments [2s→5s] and [5s→10s] for FFmpeg
    // crop purposes. But subtitle adjustment must use the ORIGINAL segment
    // [2s→10s] to avoid counting a straddling subtitle twice.
    // -----------------------------------------------------------------------
    it('REGRESSION: should NOT duplicate subtitles that straddle a camera-pan boundary', () => {
      // Original segment: [2s → 10s] — no layout sub-splitting in this test
      // Subtitle spans [3s → 7s] — straddles the hypothetical pan boundary at 5s
      const subs = [makeSub('s1', 3, 7, 'help to discover')];
      const segments = [{ startTime: 2, endTime: 10 }];

      const result = service.adjustSubtitleTimestamps(subs, segments);

      // Must appear exactly ONCE (not twice as in the bug)
      expect(result).toHaveLength(1);
      expect(result[0].startTime).toBeCloseTo(1); // 3 - 2
      expect(result[0].endTime).toBeCloseTo(5); // 7 - 2
      expect(result[0].text).toBe('help to discover');
    });

    it('should remap word timings proportionally', () => {
      const subs: SubtitleResponse[] = [
        {
          id: 's1',
          shortId: 'short-1',
          startTime: 10,
          endTime: 14,
          text: 'hello world',
          words: [
            { text: 'hello', startTime: 10, endTime: 12 },
            { text: 'world', startTime: 12, endTime: 14 },
          ],
        },
      ];
      const segments = [{ startTime: 10, endTime: 20 }];

      const result = service.adjustSubtitleTimestamps(subs, segments);

      expect(result[0].words).toHaveLength(2);
      expect(result[0].words![0].startTime).toBeCloseTo(0); // 10 - 10
      expect(result[0].words![0].endTime).toBeCloseTo(2);
      expect(result[0].words![1].startTime).toBeCloseTo(2);
      expect(result[0].words![1].endTime).toBeCloseTo(4);
    });

    it('should return empty array when no subtitles overlap any segment', () => {
      const subs = [makeSub('s1', 100, 110)]; // far outside segments
      const segments = [{ startTime: 0, endTime: 10 }];

      const result = service.adjustSubtitleTimestamps(subs, segments);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when subtitles list is empty', () => {
      const segments = [{ startTime: 0, endTime: 10 }];

      const result = service.adjustSubtitleTimestamps([], segments);

      expect(result).toHaveLength(0);
    });
  });

  describe('exportShort with/without cover image', () => {
    const testCoverPath = path.join('/tmp/yts-processing', 'test-cover.jpg');

    beforeEach(async () => {
      await fsPromises.mkdir('/tmp/yts-processing', { recursive: true });
    });

    afterEach(async () => {
      if (fs.existsSync(testCoverPath)) {
        await fsPromises.unlink(testCoverPath).catch(() => {});
      }
    });

    it('should prepend cover frame segment when short has coverImagePath (Task 4.4)', async () => {
      await fsPromises.writeFile(testCoverPath, 'fake-jpeg');
      mockProjectRepo.findOneBy.mockResolvedValue({
        id: 'proj-1',
        videoPath: '/videos/test.mp4',
      });
      mockShortRepo.findOne.mockResolvedValue({
        id: 'short-1',
        projectId: 'proj-1',
        startTime: 0,
        endTime: 5,
        coverImagePath: testCoverPath,
        segments: [
          { startTime: 0, endTime: 5, layoutMode: 'fill', centerX: 0.5 },
        ],
        subtitles: [],
      });

      await service.exportShort(
        'proj-1',
        { shortId: 'short-1' } as any,
        'job-123',
      );

      expect(mockFFmpegService.createCoverFrameSegment).toHaveBeenCalledWith(
        testCoverPath,
        expect.stringContaining('export-cover-'),
        30,
      );
      expect(
        mockFFmpegService.concatenateAndRenderVertical,
      ).toHaveBeenCalledWith(
        [
          expect.stringContaining('export-cover-'),
          expect.stringContaining('export-seg-'),
        ],
        expect.stringContaining('.mp4'),
        expect.objectContaining({
          layoutData: [
            { layoutMode: 'fill', centerX: 0.5 },
            { layoutMode: 'fill', centerX: 0.5 },
          ],
        }),
      );
    });

    it('should NOT prepend cover frame segment when short has no coverImagePath (Task 4.5)', async () => {
      mockProjectRepo.findOneBy.mockResolvedValue({
        id: 'proj-1',
        videoPath: '/videos/test.mp4',
      });
      mockShortRepo.findOne.mockResolvedValue({
        id: 'short-1',
        projectId: 'proj-1',
        startTime: 0,
        endTime: 5,
        coverImagePath: null,
        segments: [
          { startTime: 0, endTime: 5, layoutMode: 'fill', centerX: 0.5 },
        ],
        subtitles: [],
      });

      await service.exportShort(
        'proj-1',
        { shortId: 'short-1' } as any,
        'job-123',
      );

      expect(mockFFmpegService.createCoverFrameSegment).not.toHaveBeenCalled();
      expect(
        mockFFmpegService.concatenateAndRenderVertical,
      ).toHaveBeenCalledWith(
        [expect.stringContaining('export-seg-')],
        expect.stringContaining('.mp4'),
        expect.objectContaining({
          layoutData: [{ layoutMode: 'fill', centerX: 0.5 }],
        }),
      );
    });
  });
});
