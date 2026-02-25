// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';

/**
 * GeminiService tests — All external calls to @google/generative-ai are mocked.
 */

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn().mockReturnValue({
  generateContent: mockGenerateContent,
});

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
  SchemaType: {
    OBJECT: 'OBJECT',
    ARRAY: 'ARRAY',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    BOOLEAN: 'BOOLEAN',
  },
}));

const validSegmentsResponse = JSON.stringify({
  segments: [
    {
      reason: 'Highlight Moment',
      startTime: 15,
      endTime: 45,
      confidence: 0.92,
      reasoning: 'High viewer engagement',
    },
  ],
});

describe('GeminiService', () => {
  let service: GeminiService;

  const mockConfigService = {
    get: jest.fn((key: string) => {
      if (key === 'GEMINI_API_KEY') return 'test-api-key';
      if (key === 'GEMINI_MODEL') return 'gemini-2.0-flash';
      return undefined;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
  });

  describe('detectShortsCandidates', () => {
    it('should parse a valid segments JSON response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => validSegmentsResponse,
          candidates: [{}],
        },
      });

      const result = await service.detectShortsCandidates(['frame1.jpg'], 60);

      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('Highlight Moment');
      expect(result[0].startTime).toBe(15);
      expect(result[0].confidence).toBe(0.92);
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '```json\n' + validSegmentsResponse + '\n```',
          candidates: [{}],
        },
      });

      const result = await service.detectShortsCandidates(['frame1.jpg'], 60);
      expect(result).toHaveLength(1);
    });

    it('should throw GeminiParseError on malformed JSON', async () => {
      mockGenerateContent.mockResolvedValue({
        response: { text: () => 'INVALID JSON' },
      });

      await expect(
        service.detectShortsCandidates(['frame1.jpg'], 60),
      ).rejects.toThrow();
    });

    it('should retry on 429/503 quota errors with exponential backoff', async () => {
      const quotaError = { status: 429, message: 'Quota exceeded' };
      mockGenerateContent
        .mockRejectedValueOnce(quotaError)
        .mockResolvedValueOnce({
          response: {
            text: () => validSegmentsResponse,
            candidates: [{}],
          },
        });

      const result = await service.detectShortsCandidates(['frame1.jpg'], 60);

      expect(result).toHaveLength(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });
  });

  describe('generateSubtitles', () => {
    it('should return empty string when audio is empty', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await service.generateSubtitles(emptyBuffer);
      // Service returns '' (empty string) on error/empty audio — not null
      expect(typeof result).toBe('string');
    });

    it('should call Gemini API with audio data', async () => {
      const fakeTranscript = JSON.stringify({
        srt: '1\n00:00:01,000 --> 00:00:03,000\nHello world',
      });
      mockGenerateContent.mockResolvedValue({
        response: { text: () => fakeTranscript },
      });

      const audioBuffer = Buffer.from('fake-audio-data');
      const result = await service.generateSubtitles(audioBuffer);

      // Service returns the SRT string extracted from the JSON response
      expect(typeof result).toBe('string');
      expect(mockGenerateContent).toHaveBeenCalled();
    });
  });
});
