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
 * Custom error thrown when Gemini response cannot be parsed as JSON.
 */
export class GeminiParseError extends Error {
    constructor(message: string, public readonly rawResponse: string) {
        super(message);
        this.name = 'GeminiParseError';
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

        // Use configurable model, default to gemini-3-flash (stable Dec 2025)
        const modelName = this.configService.get<string>('GEMINI_MODEL', 'gemini-2.5-flash');
        this.model = this.genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.4, // Optimized for viral moment detection and creativity
                topP: 0.95,
                maxOutputTokens: 4096, // Ample space for long responses
                responseMimeType: 'application/json',
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
            model: 'gemini-2.5-flash-lite', // Supports audio
            generationConfig: {
                temperature: 0.1,
                responseMimeType: 'application/json',
            }
        });

        const prompt = `Listen to this audio and generate subtitles in SRT format.
        
        Rules:
        1. Output valid JSON in the format: { "srt": "string" }
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

            const text = result.response.text().trim();
            this.logger.log(`[Gemini] Subtitles raw response: ${text}`);
            this.logger.debug(`Text return by gemini `, text);
            try {
                const parsed = JSON.parse(text);
                return (parsed.srt || '').trim();
            } catch (e) {
                // Fallback for non-JSON or malformed JSON
                return text.replace(/```json\n?|```/g, '').trim();
            }
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
                this.logger.log(`[Gemini] Shorts detection raw response: ${response}`);

                const segments = this.parseSegmentsResponse(response);

                // If we got 0 segments, it might be a silent failure or just no segments.
                // We only retry if parsing failed or if we suspect the model hallucinated an empty response
                // (though usually we trust 0 segments if parsing was successful).
                // However, the user wants to be sure, so we could technically retry once if 0 segments found?
                // Let's stick to parsing errors for now as requested.

                this.logger.log(`Detected ${segments.length} potential Shorts segments`);
                return segments;
            } catch (error: any) {
                const isParsingError = error instanceof GeminiParseError || error.name === 'GeminiParseError';
                const status = error?.status || error?.statusCode;
                const isRetryableApiError = status === 429 || status === 503
                    || error?.message?.includes('429') || error?.message?.includes('Quota')
                    || error?.message?.includes('503') || error?.message?.includes('Service Unavailable');

                const shouldRetry = (isParsingError || isRetryableApiError) && attempt < maxRetries;

                if (shouldRetry) {
                    const delay = Math.pow(2, attempt + 1) * 10;
                    const reason = isParsingError ? 'parsing failed' : `API error ${status}`;
                    this.logger.warn(`Gemini attempt ${attempt + 1} failed (${reason}), retrying in ${delay}s...`);
                    await new Promise(resolve => setTimeout(resolve, delay * 1000));
                    continue;
                }

                if (isParsingError) {
                    this.logger.error(`Gemini parsing failed after retries: ${error.message}`);
                    throw error;
                }

                if (isRetryableApiError) {
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

**Output format (JSON array only):**
[
  {
    "startTime": 45.5,
    "endTime": 63.2,
    "confidence": 92,
    "reason": "Strong visual hook with a fast-paced punchline.",
    "smartCropData": { "centerX": 0.35, "width": 0.5625 }
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
            this.logger.log(`[Gemini] Parsing response: ${response}`);

            // 1. Initial cleanup: remove potential markdown wrappers if model disobeyed JSON mode
            let jsonText = response.trim();
            if (jsonText.startsWith('```')) {
                const match = jsonText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
                if (match) jsonText = match[1];
            }

            // 2. Aggressive repair for truncated JSON
            // If it ends with a string property but no closing quote/brace
            if (jsonText.includes('"') && !jsonText.endsWith(']') && !jsonText.endsWith('}')) {
                // Count open braces/brackets
                const openBraces = (jsonText.match(/{/g) || []).length;
                const closeBraces = (jsonText.match(/}/g) || []).length;
                const openBrackets = (jsonText.match(/\[/g) || []).length;
                const closeBrackets = (jsonText.match(/\]/g) || []).length;

                // Close unclosed quote if detected in the last few chars
                if ((jsonText.match(/"/g) || []).length % 2 !== 0) {
                    jsonText += '"';
                }

                // Add missing braces/brackets
                for (let i = 0; i < openBraces - closeBraces; i++) jsonText += '}';
                for (let i = 0; i < openBrackets - closeBrackets; i++) jsonText += ']';
            }

            let parsed;
            try {
                parsed = JSON.parse(jsonText);
            } catch (e) {
                this.logger.warn(`JSON parse failed, attempting loose cleanup. Error: ${(e as Error).message}`);
                // Simple attempt to extract anything that looks like an array
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
                if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).segments)) {
                    parsed = (parsed as any).segments;
                } else {
                    throw new Error('Response is not an array');
                }
            }

            return parsed
                .filter(
                    (seg: Record<string, unknown>) =>
                        typeof seg.startTime === 'number' &&
                        typeof seg.endTime === 'number' &&
                        seg.endTime > seg.startTime,
                )
                .map((seg: Record<string, unknown>) => ({
                    startTime: Number(seg.startTime),
                    endTime: Number(seg.endTime),
                    confidence: Number(seg.confidence) || 50,
                    reason: (seg.reason as string) || 'Interesting moment detected',
                    smartCropData: typeof seg.smartCropData === 'object' ? seg.smartCropData as any : undefined,
                }));
        } catch (error) {
            throw new GeminiParseError((error as Error).message, response);
        }
    }
}
