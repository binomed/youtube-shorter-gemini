/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */

/**
 * Shared configuration constants
 */

/** Allowed video file extensions */
export const ALLOWED_VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv'];

/** Allowed MIME types for video files */
export const ALLOWED_VIDEO_MIME_TYPES = [
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/x-matroska',
    'video/webm', // Adding webm as well for good measure if mkv is supported (often similar container)
];

/** Project Name */
export const PROJECT_NAME = 'youtube-shorter-gemini';

/** Gemini Model Information for selection */
export const GEMINI_MODELS = [
    {
        name: 'Gemini 3.5 Flash',
        code: 'gemini-3.5-flash',
        pricing: '$1.50 per 1M input / $9.00 per 1M output',
    },
    {
        name: 'Gemini 3.1 Pro (Preview)',
        code: 'gemini-3.1-pro-preview',
        pricing: '$2.00 - $4.00 per 1M input / $12.00 - $18.00 per 1M output',
    },
    {
        name: 'Gemini 3.1 Flash-Lite Preview',
        code: 'gemini-3.1-flash-lite-preview',
        pricing: '$0.05 - $0.10 per 1M input / $0.15 - $0.30 per 1M output',
    },
    {
        name: 'Gemini 3 Flash Preview',
        code: 'gemini-3-flash-preview',
        pricing: '$0.10 - $0.20 per 1M input / $0.30 - $0.60 per 1M output',
    },
    {
        name: 'Gemini 2.5 Pro',
        code: 'gemini-2.5-pro',
        pricing: '$1.25 - $2.50 per 1M input / $10.00 - $15.00 per 1M output',
    },
    {
        name: 'Gemini 2.5 Flash',
        code: 'gemini-2.5-flash',
        pricing: '$0.30 per 1M input / $2.50 per 1M output',
    },
    {
        name: 'Gemini 2.5 Flash-Lite',
        code: 'gemini-2.5-flash-lite',
        pricing: '$0.075 - $0.15 per 1M input / $0.30 - $0.60 per 1M output',
    },
    {
        name: 'Gemini 1.5 Flash',
        code: 'gemini-1.5-flash',
        pricing: 'Legacy - Stable',
    },
    {
        name: 'Gemini 1.5 Pro',
        code: 'gemini-1.5-pro',
        pricing: 'Legacy - Stable',
    },
];
