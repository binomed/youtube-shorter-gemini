// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec } from 'child_process';
import { promisify } from 'util';

/**
 * Video metadata extracted from FFmpeg
 */
export interface VideoMetadata {
  duration: number;
  resolution: string;
  codec: string;
  width: number;
  height: number;
}

/**
 * FFmpegService handles video metadata extraction using system ffprobe
 *
 * Replaces ffmpeg.wasm which is not compatible with Node.js environment.
 * Requires system ffmpeg/ffprobe to be installed.
 *
 * @service
 */
@Injectable()
export class FFmpegService {
  private readonly logger = new Logger(FFmpegService.name);

  // Dependencies removed: @ffmpeg/ffmpeg, @ffmpeg/util, fs/promises (for cache)
  // Configuration FFMPEG_CACHE_DIR is now unused but kept in Config for compatibility if needed later.

  constructor(private readonly configService: ConfigService) {}

  /**
   * Extract metadata from video file using ffprobe
   *
   * @param videoPath - Absolute path to video file
   * @returns Metadata object or null if extraction fails
   */
  async extractMetadata(videoPath: string): Promise<VideoMetadata | null> {
    try {
      // Use ffprobe to get metadata in JSON format
      // -v quiet: Suppress logs
      // -print_format json: Output as JSON
      // -show_format: Show container info (duration)
      // -show_streams: Show stream info (video codec, resolution)

      // Security Note: videoPath is validated in VideoService to be absolute and safe.
      // We wrap it in quotes to handle spaces.
      const command = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;

      this.logger.debug(`Executing: ${command}`);

      const execAsync = promisify(exec);
      const { stdout } = await execAsync(command);

      const metadata = JSON.parse(stdout);

      if (!metadata.format || !metadata.streams) {
        this.logger.warn(`Invalid metadata format for ${videoPath}`);
        return null;
      }

      // Find video stream
      const videoStream = metadata.streams.find(
        (s: any) => s.codec_type === 'video',
      );

      if (!videoStream) {
        this.logger.warn(`No video stream found in ${videoPath}`);
        return null;
      }

      // Extract relevant information
      const duration = parseFloat(metadata.format.duration);
      const width = videoStream.width;
      const height = videoStream.height;
      const resolution = `${width}x${height}`;
      const codec = videoStream.codec_name;

      return {
        duration,
        resolution,
        codec,
        width,
        height,
      };
    } catch (error) {
      this.logger.error(`Failed to extract metadata: ${error.message}`);
      // Throw error to propagate failure (Fail Fast requirement)
      throw new Error(`Metadata extraction failed: ${error.message}`);
    }
  }
}
