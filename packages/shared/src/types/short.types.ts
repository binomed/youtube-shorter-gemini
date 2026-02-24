// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

/**
 * Response DTO for a Short (viral segment detected by AI)
 */
export interface ShortResponse {
    /** Unique short identifier (UUID) */
    id: string;

    /** Parent project identifier */
    projectId: string;

    /** AI-generated title/hook */
    title: string;

    /** AI-generated description of why this is viral */
    description?: string;

    /** Start timestamp in seconds */
    startTime: number;

    /** End timestamp in seconds */
    endTime: number;

    /** AI confidence score (0-100) */
    confidence: number;

    /** Display order */
    orderIndex: number;

    /** URL to get the thumbnail */
    thumbnailUrl?: string;

    /**
     * Whether audio stems (vocals + accompaniment) have already been separated.
     * If true, the audio panel can directly show the stems player.
     */
    stemsAvailable: boolean;

    /** Creation timestamp (ISO 8601) */
    createdAt: string;
}

/**
 * Response from the analysis endpoint
 */
export interface AnalysisResponse {
    /** Project ID that was analyzed */
    projectId: string;

    /** Number of shorts detected */
    count: number;

    /** Detected shorts */
    shorts: ShortResponse[];
}

/**
 * SSE progress event during analysis
 */
export interface AnalysisProgressEvent {
    /** Current phase */
    phase: 'extracting_frames' | 'transcribing' | 'analyzing' | 'saving' | 'complete' | 'error';

    /** Progress percentage (0-100) */
    progress: number;

    /** Human-readable status message */
    message: string;
}

/**
 * Detected Shorts segment structure from Gemini response.
 */
export interface DetectedSegment {
    startTime: number;
    endTime: number;
    confidence: number;
    reason: string;
    subjectPosition?: string;
    smartCropData?: {
        centerX: number;
        width: number;
    };
}

/**
 * SSE progress event during audio stem separation.
 */
export interface StemProgressEvent {
    /** Current phase */
    phase: 'extracting' | 'separating' | 'saving' | 'complete' | 'error';

    /** Progress percentage (0-100) */
    progress: number;

    /** Human-readable status message */
    message: string;

    /** Short ID being processed */
    shortId: string;
}
