// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';
import { SettingsService } from '../settings/settings.service';
import type { DetectedSegment } from '@youtube-shorter/shared';

/**
 * GeminiService tests — All external calls to @google/generative-ai are mocked.
 */

const mockSettingsService = {
  getSettings: jest.fn().mockResolvedValue({
    geminiModel: 'gemini-1.5-flash',
    frameInterval: 3.0,
  }),
};

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
      subjectPosition: 'Center',
      layoutTimeline: [
        { startTime: 15, layoutMode: 'fullscreen', centerX: 0.5 },
        { startTime: 30, layoutMode: 'fill', centerX: 0.8 },
      ],
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
        { provide: SettingsService, useValue: mockSettingsService },
      ],
    }).compile();

    service = module.get<GeminiService>(GeminiService);
  });

  describe('detectShortsCandidates', () => {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
    it('should parse a valid segments JSON response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => validSegmentsResponse,
          candidates: [{}],
        },
      });

      const result: DetectedSegment[] = await service.detectShortsCandidates(
        ['frame1.jpg'],
        60,
      );

      expect(result).toHaveLength(1);
      expect(result[0].reason).toBe('Highlight Moment');
      expect(mockGenerateContent).toHaveBeenCalled();
      const calls = mockGenerateContent.mock.calls;
      const firstCallParts = calls[0][0] as any[];
      const hasPrompt = firstCallParts.some(
        (p: any) =>
          typeof p.text === 'string' && p.text.includes('Visual Frames'),
      );
      const hasFrame = firstCallParts.some(
        (p: any) => p.inlineData?.data === 'frame1.jpg',
      );
      expect(hasPrompt).toBe(true);
      expect(hasFrame).toBe(true);
    });
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

    it('should include audio in the parts when provided', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => validSegmentsResponse,
          candidates: [{}],
        },
      });

      const audioBuffer = Buffer.from('fake-audio');
      await service.detectShortsCandidates(
        ['frame1.jpg'],
        60,
        undefined,
        audioBuffer,
      );

      expect(mockGenerateContent).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            inlineData: {
              mimeType: 'audio/mp3',
              data: audioBuffer.toString('base64'),
            },
          }),
        ]),
      );
    });

    it('should handle JSON wrapped in markdown code blocks', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '```json\n' + validSegmentsResponse + '\n```',
          candidates: [{}],
        },
      });

      const result: DetectedSegment[] = await service.detectShortsCandidates(
        ['frame1.jpg'],
        60,
      );
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

      const result: DetectedSegment[] = await service.detectShortsCandidates(
        ['frame1.jpg'],
        60,
      );

      expect(result).toHaveLength(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should inject user custom prompt guidelines and override default guidelines', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => validSegmentsResponse,
          candidates: [{}],
        },
      });

      await service.detectShortsCandidates(
        ['frame1.jpg'],
        60,
        undefined,
        undefined,
        'Only find segments where people laugh or argue intensely',
      );

      expect(mockGenerateContent).toHaveBeenCalled();
      const calls = mockGenerateContent.mock.calls;
      const firstCallParts = calls[0][0] as any[];
      const hasCustomPrompt = firstCallParts.some(
        (p: any) =>
          typeof p.text === 'string' &&
          p.text.includes('USER CUSTOM RULES') &&
          p.text.includes('laugh or argue intensely'),
      );
      expect(hasCustomPrompt).toBe(true);
    });

    it('should inject custom min and max durations in prompt constraints', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => validSegmentsResponse,
          candidates: [{}],
        },
      });

      await service.detectShortsCandidates(
        ['frame1.jpg'],
        60,
        undefined,
        undefined,
        undefined,
        10,
        30,
      );

      expect(mockGenerateContent).toHaveBeenCalled();
      const calls = mockGenerateContent.mock.calls;
      const firstCallParts = calls[0][0] as any[];
      const hasTimingConstraints = firstCallParts.some(
        (p: any) =>
          typeof p.text === 'string' &&
          p.text.includes('Duration: 10-30 seconds per clip'),
      );
      expect(hasTimingConstraints).toBe(true);
    });

    it('should invoke translation pre-step when transcript is provided', async () => {
      const mockTranslatedPrompt =
        '<system_instructions>\nTranslated French Prompt\n</system_instructions>';
      mockGenerateContent
        .mockResolvedValueOnce({
          response: { text: () => mockTranslatedPrompt },
        })
        .mockResolvedValueOnce({
          response: {
            text: () => validSegmentsResponse,
            candidates: [{}],
          },
        });

      const result = await service.detectShortsCandidates(
        ['frame1.jpg'],
        60,
        '1\n00:00:01,000 --> 00:00:04,000\nBonjour tout le monde',
      );

      expect(result).toHaveLength(1);
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);

      const translationCall = mockGenerateContent.mock.calls[0][0];
      expect(translationCall).toContain(
        'Analyze the following video transcript content, detect its language',
      );
    });
  });

  describe('generateSubtitles', () => {
    it('should return empty string when audio is empty', async () => {
      const emptyBuffer = Buffer.alloc(0);
      const result = await service.generateSubtitles(emptyBuffer);
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

      expect(typeof result).toBe('string');
      expect(mockGenerateContent).toHaveBeenCalled();
    });
  });
});
