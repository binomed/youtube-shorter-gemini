// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GoogleGenerativeAI,
  GenerativeModel,
  SchemaType,
} from '@google/generative-ai';
import type { DetectedSegment } from '@youtube-shorter/shared';

/** Shape of errors thrown by the Gemini SDK */
interface GeminiApiError extends Error {
  status?: number;
  statusCode?: number;
}

interface RawLayoutEvent {
  startTime?: number;
  layoutMode?: 'fill' | 'fullscreen';
  centerX?: number;
}

/** Typed JSON parsed from segment response */
interface RawSegment {
  startTime?: number;
  endTime?: number;
  confidence?: number;
  reason?: string;
  subjectPosition?: string;
  smartCropData?: { centerX?: number; width?: number };
  layoutMode?: 'fill' | 'fullscreen';
  layoutTimeline?: RawLayoutEvent[];
}

/**
 * Custom error thrown when Gemini response cannot be parsed as JSON.
 */
export class GeminiParseError extends Error {
  constructor(
    message: string,
    public readonly rawResponse: string,
  ) {
    super(message);
    this.name = 'GeminiParseError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Service for interacting with Gemini AI for video analysis.
 * Uses frame sampling approach: extracts JPEG frames via FFmpeg,
 * sends them as base64 to Gemini for multimodal analysis.
 *
 * @see Gemini AI Integration skill for patterns and best practices
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');

    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not found, Gemini features disabled');
    }

    this.genAI = new GoogleGenerativeAI(apiKey || '');

    // Use configurable model, default to gemini-1.5-flash (more stable than preview)
    const modelName = this.configService.get<string>(
      'GEMINI_MODEL',
      'gemini-1.5-flash',
    );
    this.model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.4, // Optimized for viral moment detection and creativity
        topP: 0.95,
        maxOutputTokens: 8192, // Bumped to 8192 for large video frame counts
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          description: 'List of highly engaging short video segments',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              startTime: {
                type: SchemaType.NUMBER,
                description:
                  'Start time of the segment in seconds (e.g., 25.5)',
              },
              endTime: {
                type: SchemaType.NUMBER,
                description: 'End time of the segment in seconds (e.g., 40.0)',
              },
              confidence: {
                type: SchemaType.NUMBER,
                description: 'Viral potential confidence score (0 to 100)',
              },
              reason: {
                type: SchemaType.STRING,
                description: 'Explanation of why this segment is engaging',
              },
              subjectPosition: {
                type: SchemaType.STRING,
                description:
                  "Detailed description of where the main person is standing or moving in the video frames (e.g., 'Standing on the left', 'Perfectly centered', 'On the right'). You MUST look at the images.",
              },
              layoutTimeline: {
                type: SchemaType.ARRAY,
                description:
                  'Sequence of layout/framing changes WITHIN this segment. You MUST provide at least one event at the start of the segment. If the subject moves or the scene changes layout type, add more events.',
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    startTime: {
                      type: SchemaType.NUMBER,
                      description:
                        'Time in seconds (absolute from start of video) when this layout configuration starts.',
                    },
                    layoutMode: {
                      type: SchemaType.STRING,
                      description:
                        "Display mode: 'fill' (standard vertical crop) or 'fullscreen' (scaled original with blurred background).",
                    },
                    centerX: {
                      type: SchemaType.NUMBER,
                      description:
                        'Center X coordinate (0.0 to 1.0) of the main subject at this time. 0.5 is center.',
                    },
                  },
                  required: ['startTime', 'layoutMode', 'centerX'],
                },
              },
            },
            required: [
              'startTime',
              'endTime',
              'confidence',
              'reason',
              'subjectPosition',
            ],
          },
        },
      },
    });

    this.logger.log(`Gemini initialized with model: ${modelName}`);
  }

  /**
   * Generate SRT subtitles from audio buffer using Gemini.
   */
  async generateSubtitles(audioBuffer: Buffer): Promise<string> {
    // Use stable model for better compliance
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: SchemaType.ARRAY,
          description: 'A list of short subtitle segments.',
          items: {
            type: SchemaType.OBJECT,
            properties: {
              startTime: {
                type: SchemaType.NUMBER,
                description: 'Start time in seconds (e.g. 1.25)',
              },
              endTime: {
                type: SchemaType.NUMBER,
                description: 'End time in seconds (e.g. 2.50)',
              },
              text: {
                type: SchemaType.STRING,
                description: 'The exact spoken words. MAXIMUM 5 WORDS!',
              },
            },
            required: ['startTime', 'endTime', 'text'],
          },
        },
      },
    });

    const prompt = `Listen to this audio and transcribe it into sequential subtitle segments.
        
        Rules:
        1. Output a JSON array of segment objects.
        2. Accurately capture the start time and end time in seconds.
        3. CRITICAL: Break the transcription into VERY SHORT phrases. Each text block MUST contain a maximum of 5 words.
        4. Do not group long sentences together.
        
        Example Output Format:
        \`\`\`json
        [
          {
            "startTime": 0.5,
            "endTime": 1.8,
            "text": "Welcome to my new video!"
          },
          {
            "startTime": 1.9,
            "endTime": 3.1,
            "text": "Today we are going to learn"
          },
          {
            "startTime": 3.2,
            "endTime": 4.5,
            "text": "something truly incredible."
          }
        ]
        \`\`\``;

    try {
      const result = await model.generateContent([
        { text: prompt },
        {
          inlineData: {
            mimeType: 'audio/mp3',
            data: audioBuffer.toString('base64'),
          },
        },
      ]);

      const text = result.response.text().trim();
      this.logger.log(`[Gemini] Subtitles raw response received`);
      this.logger.debug(
        `Text return by gemini `,
        text.substring(0, 200) + '...',
      );

      let segments: Array<{
        startTime: number;
        endTime: number;
        text: string;
      }> = [];
      try {
        segments = JSON.parse(text) as Array<{
          startTime: number;
          endTime: number;
          text: string;
        }>;
      } catch {
        // Fallback for markdown blocks
        const cleanText = text.replace(/```json\n?|```/g, '').trim();
        try {
          segments = JSON.parse(cleanText) as Array<{
            startTime: number;
            endTime: number;
            text: string;
          }>;
        } catch {
          throw new GeminiParseError(
            'Could not process subtitle JSON format',
            cleanText,
          );
        }
      }

      let srtData = '';
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        srtData += `${i + 1}\n`;
        srtData += `${this.formatSrtTime(seg.startTime)} --> ${this.formatSrtTime(seg.endTime)}\n`;
        srtData += `${seg.text.trim()}\n\n`;
      }
      return srtData.trim();
    } catch (error) {
      this.logger.error(
        `Subtitle generation failed: ${(error as Error).message}`,
        error,
      );
      return ''; // Return empty string on failure to allow analysis to proceed
    }
  }

  private formatSrtTime(seconds: number): string {
    const date = new Date(seconds * 1000);
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
  }

  /**
   * Analyze video frames to detect interesting moments for Shorts.
   * Returns array of suggested segments with timestamps and reasons.
   *
   * @param videoFrames - Array of base64-encoded JPEG frames
   * @param videoDuration - Total video duration in seconds
   * @param transcript - Optional transcript/SRT context
   * @returns Array of detected segments
   */
  async detectShortsCandidates(
    videoFrames: string[],
    videoDuration: number,
    transcript?: string,
  ): Promise<DetectedSegment[]> {
    // Calculate actual interval based on frame count
    const frameInterval =
      videoFrames.length > 1 ? videoDuration / videoFrames.length : 0;

    const prompt = this.buildDetectionPrompt(
      videoDuration,
      frameInterval,
      transcript,
    );

    const parts: Array<
      { text: string } | { inlineData: { mimeType: string; data: string } }
    > = [
      { text: prompt },
      ...videoFrames.map((frame) => ({
        inlineData: {
          mimeType: 'image/jpeg' as const,
          data: frame,
        },
      })),
    ];

    // Retry with exponential backoff for quota/rate-limit errors
    const maxRetries = 3;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.logger.debug(
          `Sending ${videoFrames.length} frames to Gemini (attempt ${attempt + 1})...`,
        );
        const result = await this.model.generateContent(parts);

        // Safeguard against blocked responses
        if (result.response.promptFeedback?.blockReason) {
          throw new Error(
            `Gemini request blocked: ${result.response.promptFeedback.blockReason}`,
          );
        }

        if (
          !result.response.candidates ||
          result.response.candidates.length === 0
        ) {
          throw new Error('Gemini returned no candidates');
        }

        const response = result.response.text();
        this.logger.debug(
          `[Gemini] Shorts detection raw response: ${response.substring(0, 500)}...`,
        );

        const segments = this.parseSegmentsResponse(response);

        // If we got 0 segments, it might be a silent failure or just no segments.
        // We only retry if parsing failed or if we suspect the model hallucinated an empty response
        // (though usually we trust 0 segments if parsing was successful).
        // However, the user wants to be sure, so we could technically retry once if 0 segments found?
        // Let's stick to parsing errors for now as requested.

        this.logger.debug(
          `Detected ${segments.length} potential Shorts segments`,
        );
        return segments;
      } catch (error: unknown) {
        const err = error as GeminiApiError;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const isParsingError =
          error instanceof GeminiParseError || err.name === 'GeminiParseError';
        const status: number | undefined = err.status ?? err.statusCode;
        const isRetryableApiError =
          status === 429 ||
          status === 503 ||
          errorMessage.includes('429') ||
          errorMessage.includes('Quota') ||
          errorMessage.includes('503') ||
          errorMessage.includes('Service Unavailable');

        const shouldRetry =
          (isParsingError || isRetryableApiError) && attempt < maxRetries;

        if (shouldRetry) {
          const delaySeconds = Math.pow(2, attempt) * 2; // 2s, 4s, 8s
          const reason = isParsingError
            ? 'parsing failed'
            : `API error ${status || 'unknown'}`;
          this.logger.warn(
            `Gemini attempt ${attempt + 1} failed (${reason}), retrying in ${delaySeconds}s...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, delaySeconds * 1000),
          );
          continue;
        }

        if (isParsingError) {
          this.logger.error(
            `Gemini parsing failed after retries: ${errorMessage}`,
          );
          throw error;
        }

        if (isRetryableApiError) {
          this.logger.error(
            `Gemini API unavailable (retryable) after retries. Error: ${errorMessage}`,
          );
          throw new Error(this.interpretGeminiError(error));
        }

        this.logger.error(
          `Gemini API error (non-retryable): ${errorMessage}`,
          error,
        );
        throw new Error(this.interpretGeminiError(error));
      }
    }

    return []; // Unreachable, but TypeScript needs it
  }

  /**
   * Translates raw Gemini API errors into user-friendly messages.
   * Prevents "wall of text" payloads from reaching the UI.
   */
  private interpretGeminiError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const err = error as GeminiApiError;
    const status = err.status ?? err.statusCode;

    // 1. Quota / Rate Limit (429)
    if (
      status === 429 ||
      errorMessage.includes('429') ||
      errorMessage.includes('Quota')
    ) {
      return "You've reached the Gemini API quota limit. please wait a few seconds and try again. If you are on the free tier, this is common during busy periods.";
    }

    // 2. Service Overload / Unavailable (503)
    if (
      status === 503 ||
      errorMessage.includes('503') ||
      errorMessage.includes('Service Unavailable')
    ) {
      return "Gemini is currently overloaded or undergoing maintenance. We've tried multiple times, but it remains unresponsive. Please try again in a few minutes.";
    }

    // 3. Safety / Blocked Content (not 4xx/5xx but field in response)
    if (errorMessage.includes('blocked') || errorMessage.includes('Safety')) {
      return 'The AI safety filters blocked the analysis of this video. Try a different video or adjust the content.';
    }

    // 4. Fallback for parsing errors
    if (error instanceof GeminiParseError || errorMessage.includes('parse')) {
      return "Gemini returned an invalid response format. We're retrying, but if this persists, the video content might be too complex for analysis.";
    }

    // 5. General Fallback
    return 'Gemini encountered an unexpected error. Please wait a moment and try again.';
  }

  /**
   * Build the detection prompt with clear instructions and output format.
   * Uses few-shot and chain-of-thought patterns from the Gemini skill.
   */
  private buildDetectionPrompt(
    duration: number,
    interval: number,
    transcript?: string,
  ): string {
    return `You are an expert video editor for YouTube Shorts and TikTok. Analyze these video frames ${transcript ? 'and the provided audio transcript' : ''} to identify the most engaging, punchy 15-35 second segments ("petits bouts").

**Context:**
- Total video duration: ${duration} seconds
- Frame interval: approx ${interval.toFixed(2)} seconds
${transcript ? `- Transcript/Subtitles: see below\n\n${transcript.slice(0, 10000)}\n(transcript truncated if too long)` : ''}

**Your task:**
1. Identify 3-5 high-retention viral moments. Focus on short, dynamic punchlines, interesting facts, or strong hooks. Avoid dragging concepts over 40 seconds.
2. For each moment, distinctively suggest "smart crop" metadata to keep the main subject centered in a 9:16 vertical frame.
    - The source is likely 16:9 landscape.
    - Analyze the visual frames in the segment: Where is the main speaker? Are they on the left side, right side, or moving?
    - Set \`centerX\` (0.0 to 1.0) to the exact actual position of the main speaker/subject (e.g., 0.25 if offset to the left, 0.75 if offset to the right). 
    - CRITICAL: DO NOT default to 0.5 unless the subject is perfectly dead-center.
    - \`width\` should typically be 0.5625 (9/16) of the original width to fill the height.
3. Determine the \`layoutMode\`:
   - Use 'fill' for talking heads or central subjects where a 9:16 crop works perfectly.
   - Use 'fullscreen' if the scene contains critical information across the full width (e.g., broad landscape action, gameplay UI, or long horizontal text) that would look weird or be lost if cropped to vertical.

**Output format (JSON array only):**
[
  {
    "startTime": 45.5,
    "endTime": 63.2,
    "confidence": 92,
    "reason": "Strong visual hook with a fast-paced punchline.",
    "subjectPosition": "The speaker moves from left to center.",
    "smartCropData": { "centerX": 0.25, "width": 0.5625 },
    "layoutMode": "fill",
    "layoutTimeline": [
      { "startTime": 45.5, "layoutMode": "fill", "centerX": 0.25 },
      { "startTime": 55.0, "layoutMode": "fill", "centerX": 0.5 }
    ]
  }
]

IMPORTANT: Return a valid JSON array. If no segments are found, return [].`;
  }

  /**
   * Parse Gemini's text response into structured segments.
   * Handles markdown code blocks and malformed JSON gracefully.
   */
  parseSegmentsResponse(response: string): DetectedSegment[] {
    try {
      this.logger.debug(
        `[Gemini] Parsing response: ${response.substring(0, 200)}...`,
      );

      // 1. Initial cleanup: remove potential markdown wrappers if model disobeyed JSON mode
      let jsonText = response.trim();
      if (jsonText.startsWith('```')) {
        const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match) jsonText = match[1];
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(jsonText);
      } catch (e) {
        this.logger.warn(
          `JSON parse failed, attempting loose extraction. Error: ${(e as Error).message}`,
        );
        // Safe and simple attempt to extract anything that looks like an array
        const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw e;
        }
      }

      // Validate structure
      if (!Array.isArray(parsed)) {
        // If it's an object with a segments array (sometimes model does this even in JSON mode)
        const parsedObj = parsed as Record<string, unknown>;
        if (
          parsedObj &&
          typeof parsedObj === 'object' &&
          Array.isArray(parsedObj.segments)
        ) {
          parsed = parsedObj.segments;
        } else {
          throw new Error('Response is not an array');
        }
      }

      const segments = parsed as RawSegment[];
      return segments
        .filter(
          (seg) =>
            typeof seg.startTime === 'number' &&
            typeof seg.endTime === 'number' &&
            (seg.endTime ?? 0) > (seg.startTime ?? 0),
        )
        .map((seg) => ({
          startTime: Number(seg.startTime),
          endTime: Number(seg.endTime),
          confidence: Number(seg.confidence) || 50,
          reason: (seg.reason as string) || 'Interesting moment detected',
          subjectPosition:
            typeof seg.subjectPosition === 'string'
              ? seg.subjectPosition
              : undefined,
          layoutTimeline: Array.isArray(seg.layoutTimeline)
            ? seg.layoutTimeline.map((ev) => ({
                timestamp: Number(ev.startTime),
                layoutMode: (ev.layoutMode as 'fill' | 'fullscreen') || 'fill',
                centerX: typeof ev.centerX === 'number' ? ev.centerX : 0.5,
              }))
            : undefined,
        }));
    } catch (error) {
      throw new GeminiParseError((error as Error).message, response);
    }
  }
}
