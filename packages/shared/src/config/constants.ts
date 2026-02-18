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
