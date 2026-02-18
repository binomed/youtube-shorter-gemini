// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FFmpegService } from './ffmpeg.service';
import * as child_process from 'child_process';
import util from 'util';

// Mock child_process and util.promisify
jest.mock('child_process');
jest.mock('util', () => ({
  ...jest.requireActual('util'),
  promisify: jest.fn(),
}));

describe('FFmpegService', () => {
  let service: FFmpegService;
  let mockExecAsync: jest.Mock;

  beforeEach(async () => {
    // Create mock for execAsync
    mockExecAsync = jest.fn();
    (util.promisify as unknown as jest.Mock).mockReturnValue(mockExecAsync);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FFmpegService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FFmpegService>(FFmpegService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractMetadata', () => {
    const mockVideoPath = '/path/to/video.mp4';

    it('should extract metadata successfully', async () => {
      const mockOutput = {
        format: { duration: '120.5' },
        streams: [
          {
            codec_type: 'video',
            width: 1920,
            height: 1080,
            codec_name: 'h264',
          },
        ],
      };

      mockExecAsync.mockResolvedValue({ stdout: JSON.stringify(mockOutput) });

      const result = await service.extractMetadata(mockVideoPath);

      expect(result).toEqual({
        duration: 120.5,
        resolution: '1920x1080',
        codec: 'h264',
        width: 1920,
        height: 1080,
      });
      expect(mockExecAsync).toHaveBeenCalledWith(
        expect.stringContaining(
          `ffprobe -v quiet -print_format json -show_format -show_streams "${mockVideoPath}"`,
        ),
      );
    });

    it('should return null if no video stream found', async () => {
      const mockOutput = {
        format: { duration: '10' },
        streams: [
          {
            codec_type: 'audio', // Only audio
          },
        ],
      };

      mockExecAsync.mockResolvedValue({ stdout: JSON.stringify(mockOutput) });

      const result = await service.extractMetadata(mockVideoPath);

      expect(result).toBeNull();
    });

    it('should return null for invalid metadata format', async () => {
      mockExecAsync.mockResolvedValue({ stdout: '{}' });

      const result = await service.extractMetadata(mockVideoPath);

      expect(result).toBeNull();
    });

    it('should throw error if ffprobe fails', async () => {
      const errorMessage = 'Command failed';
      mockExecAsync.mockRejectedValue(new Error(errorMessage));

      await expect(service.extractMetadata(mockVideoPath)).rejects.toThrow(
        `Metadata extraction failed: ${errorMessage}`,
      );
    });
  });
});
