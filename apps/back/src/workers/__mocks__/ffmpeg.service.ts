// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

/**
 * Mock FFmpegService for unit testing
 * 
 * Avoids Jest ESM module issues with @ffmpeg/ffmpeg package
 */
export class FFmpegService {
    extractMetadata = jest.fn();
}
