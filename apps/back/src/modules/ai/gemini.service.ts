// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

/**
 * Detected Shorts segment structure from Gemini response.
 */
export interface DetectedSegment {
    startTime: number;
    endTime: number;
    confidence: number;
    reason: string;
    smartCropData?: {
        centerX: number;
        width: number;
    };
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

        // Use configurable model, default to gemini-3-flash (stable Dec 2025)
        const modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
        this.model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.4, // Lower = more deterministic for structured output
                topP: 0.95,
                maxOutputTokens: 4096,
            },
        });

        this.logger.log(`Gemini initialized with model: ${modelName}`);
    }

    /**
     * Analyze video frames to detect interesting moments for Shorts.
     * Returns array of suggested segments with timestamps and reasons.
     *
     * @param videoFrames - Array of base64-encoded JPEG frames
     * @param videoDuration - Total video duration in seconds
     * @returns Array of detected segments
     */
    /**
     * Generate SRT subtitles from audio buffer using Gemini.
     */
    async generateSubtitles(audioBuffer: Buffer): Promise<string> {
        // Use Gemini 1.5 Flash for efficient audio processing
        const model = this.genAI.getGenerativeModel({
            model: 'gemini-2.0-flash-exp', // Supports audio
            generationConfig: {
                temperature: 0.1,
            }
        });

        const prompt = `Listen to this audio and generate subtitles in SRT format.
        
        Rules:
        1. Output ONLY the valid SRT content. No markdown, no "Here is the SRT".
        2. Ensure timestamps are accurate.
        3. Break lines naturally.`;

        try {
            const result = await model.generateContent([
                { text: prompt },
                {
                    inlineData: {
                        mimeType: 'audio/mp3',
                        data: audioBuffer.toString('base64')
                    }
                }
            ]);

            return result.response.text().trim();
        } catch (error) {
            this.logger.error(`Subtitle generation failed: ${(error as Error).message}`);
            return ''; // Return empty string on failure to allow analysis to proceed
        }
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
        const frameInterval = videoFrames.length > 1
            ? videoDuration / videoFrames.length
            : 0;

        const prompt = this.buildDetectionPrompt(videoDuration, frameInterval, transcript);

        const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
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
                this.logger.log(`Sending ${videoFrames.length} frames to Gemini (attempt ${attempt + 1})...`);
                const result = await this.model.generateContent(parts);
                const response = result.response.text();

                const segments = this.parseSegmentsResponse(response);
                this.logger.log(`Detected ${segments.length} potential Shorts segments`);
                return segments;
            } catch (error: any) {
                const status = error?.status || error?.statusCode;
                const isRetryable = status === 429 || status === 503
                    || error?.message?.includes('429') || error?.message?.includes('Quota')
                    || error?.message?.includes('503') || error?.message?.includes('Service Unavailable');

                if (isRetryable && attempt < maxRetries) {
                    const delay = Math.pow(2, attempt + 1) * 10; // 20s, 40s, 80s
                    this.logger.warn(`Gemini temporarily unavailable (${status}), retrying in ${delay}s (attempt ${attempt + 1}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                    continue;
                }

                if (isRetryable) {
                    this.logger.error('Gemini API unavailable after retries');
                    throw new Error('Gemini API is currently unavailable. Please wait a few minutes and try again, or switch to a different model (e.g. gemini-2.5-flash).');
                }

                this.logger.error(`Gemini API error: ${(error as Error).message}`);
                throw error;
            }
        }

        return []; // Unreachable, but TypeScript needs it
    }

    /**
     * Build the detection prompt with clear instructions and output format.
     * Uses few-shot and chain-of-thought patterns from the Gemini skill.
     */
    private buildDetectionPrompt(duration: number, interval: number, transcript?: string): string {
        return `You are an expert video editor for YouTube Shorts. Analyze these video frames ${transcript ? 'and the provided audio transcript' : ''} to identify the most engaging 30-60 second segments.

**Context:**
- Total video duration: ${duration} seconds
- Frame interval: approx ${interval.toFixed(2)} seconds
${transcript ? `- Transcript/Subtitles: see below\n\n${transcript.slice(0, 10000)}\n(transcript truncated if too long)` : ''}

**Your task:**
1. Identify 3-5 detected viral moments.
2. For each moment, distinctively suggest "smart crop" coordinates to keep the subject centered in a 9:16 vertical frame (1080x1920).
   - The source is likely 16:9 landscape.
   - You need to determine the \`centerX\` (0.0 to 1.0) of the subject.
   - \`width\` should typically be 0.5625 (9/16) of the original width to fill the height, or adjusted if needed.

**Output format (JSON only):**
[
  {
    "startTime": 45.5,
    "endTime": 78.2,
    "confidence": 85,
    "reason": "Strong visual hook",
    "smartCropData": { "centerX": 0.5, "width": 0.5625 }
  }
]

IMPORTANT: Return ONLY the JSON array.`;
    }

    /**
     * Parse Gemini's text response into structured segments.
     * Handles markdown code blocks and malformed JSON gracefully.
     */
    parseSegmentsResponse(response: string): DetectedSegment[] {
        try {
            this.logger.debug(`Raw Gemini response: ${response}`);

            // Extract JSON array using regex to be robust against conversational text
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            let jsonText = jsonMatch ? jsonMatch[0] : response;

            // Cleanup any remaining markdown artifacts if regex missed them (fallback)
            jsonText = jsonText.replace(/```json\n?/g, '');
            jsonText = jsonText.replace(/```\n?/g, '');
            jsonText = jsonText.trim();

            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            } catch (e) {
                this.logger.warn(`JSON parse failed, attempting loose cleanup. Error: ${(e as Error).message}`);
                // Try one more aggressive cleanup if simple parse fails
                // Sometimes models output [ { ... }, { ... } ] with trailing commas or comments
                // This is a best-effort simple fix
                jsonText = jsonText.replace(/,\s*\]/, ']'); // remove trailing comma
                parsed = JSON.parse(jsonText);
            }

            // Validate structure
            if (!Array.isArray(parsed)) {
                throw new Error('Response is not an array');
            }

            return parsed
                .filter(
                    (seg: Record<string, unknown>) =>
                        typeof seg.startTime === 'number' &&
                        typeof seg.endTime === 'number' &&
                        seg.endTime > seg.startTime,
                )
                .map((seg: Record<string, unknown>, idx: number) => ({
                    startTime: Number(seg.startTime),
                    endTime: Number(seg.endTime),
                    confidence: Number(seg.confidence) || 50,
                    reason: (seg.reason as string) || 'Interesting moment detected',
                }));
        } catch (error) {
            this.logger.error(`Failed to parse Gemini response: ${(error as Error).message}`);
            this.logger.debug(`Original response was: ${response}`);
            return [];
        }
    }
}
