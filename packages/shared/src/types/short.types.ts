// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

/**
 * Event defining a layout/framing change at a specific timestamp.
 */
export interface LayoutEvent {
    /** Absolute timestamp in the original video */
    timestamp: number;
    /** Recommended display mode */
    layoutMode: 'fill' | 'fullscreen';
    /** Center X coordinate of the main subject (0.0 to 1.0) */
    centerX: number;
}

/**
 * Individual video segment within a short
 */
export interface VideoSegment {
    startTime: number;
    endTime: number;
    /** 
     * Timeline of layout changes within this segment.
     * If empty, fallback to centerX and layoutMode properties.
     */
    layoutTimeline?: LayoutEvent[];
    centerX?: number;
    layoutMode?: 'fill' | 'fullscreen';
}

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

    /** URL to get the custom cover image (user-uploaded, used as first frame in export) */
    coverImageUrl?: string;

    /**
     * Whether audio stems (vocals + accompaniment) have already been separated.
     * If true, the audio panel can directly show the stems player.
     */
    stemsAvailable: boolean;

    /**
     * User-customized subtitle styling preferences.
     */
    subtitleStyle?: SubtitleStyle;

    /**
     * List of segments (jump cuts) that compose this short.
     * If empty, fallback to the top-level startTime/endTime.
     */
    segments?: VideoSegment[];

    /**
     * List of subtitles associated with this short.
     */
    subtitles?: SubtitleResponse[];

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
    phase: 'extracting_frames' | 'transcribing' | 'translating_prompt' | 'analyzing' | 'saving' | 'complete' | 'error';

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
    /** 
     * Timeline of layout changes detected by AI.
     */
    layoutTimeline?: LayoutEvent[];
    layoutMode?: 'fill' | 'fullscreen';
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

/**
 * SSE progress event during export.
 */
export interface ExportProgressEvent {
    /** Current phase */
    phase: 'extracting' | 'processing' | 'saving' | 'complete' | 'error';

    /** Progress percentage (0-100) */
    progress: number;

    /** Human-readable status message */
    message: string;

    /** Short ID being exported */
    shortId: string;

    /** Final URL for downloading the exported file (set when phase is complete) */
    exportUrl?: string;
}

/**
 * Individual word timing for highlight effects.
 */
export interface WordTiming {
    text: string;
    startTime: number;
    endTime: number;
}

/**
 * User-customizable subtitle styling preferences.
 */
export interface SubtitleStyle {
    font?: string;
    fontSize?: number;
    color?: string;
    backgroundColor?: string;
    positionY?: number;
    positionX?: number;
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    borderEnabled?: boolean;
    borderWidth?: number;
    borderColor?: string;
    textShadow?: boolean;
    textOutline?: boolean;
    highlightEnabled?: boolean;
    highlightColor?: string;
    highlightScale?: number;
}

/**
 * Response DTO for a single subtitle segment.
 */
export interface SubtitleResponse {
    id: string;
    shortId: string;
    startTime: number;
    endTime: number;
    text: string;
    words?: WordTiming[];
}
