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
 * Typed structure of ffprobe JSON output
 */
interface FFprobeStream {
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
}

interface FFprobeOutput {
  format?: { duration?: string };
  streams?: FFprobeStream[];
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

      const metadata = JSON.parse(stdout) as FFprobeOutput;

      if (!metadata.format || !metadata.streams) {
        this.logger.warn(`Invalid metadata format for ${videoPath}`);
        return null;
      }

      // Find video stream
      const videoStream = metadata.streams?.find(
        (s: FFprobeStream) => s.codec_type === 'video',
      );

      if (!videoStream) {
        this.logger.warn(`No video stream found in ${videoPath}`);
        return null;
      }

      // Extract relevant information
      const duration = parseFloat(metadata.format?.duration ?? '0');
      const width = videoStream.width ?? 0;
      const height = videoStream.height ?? 0;
      const resolution = `${width}x${height}`;
      const codec = videoStream.codec_name ?? 'unknown';

      return {
        duration,
        resolution,
        codec,
        width,
        height,
      };
    } catch (error) {
      this.logger.error(
        `Failed to extract metadata: ${(error as Error).message}`,
      );
      // Throw error to propagate failure (Fail Fast requirement)
      throw new Error(
        `Metadata extraction failed: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Extract a single frame as a thumbnail from the video
   *
   * @param videoPath - Absolute path to video file
   * @param outputPath - Absolute path where thumbnail should be saved
   * @param timestamp - Time in seconds to extract frame from
   * @returns void
   */
  async extractThumbnail(
    videoPath: string,
    outputPath: string,
    timestamp: number,
  ): Promise<void> {
    try {
      // ffmpeg -ss <timestamp> -i <videoPath> -vframes 1 -q:v 2 -y <outputPath>
      // -ss: seek to position (fast seek before input)
      // -vframes 1: output one frame
      // -q:v 2: high quality jpeg (2-5 is good range)
      // -y: overwrite output

      const command = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 -y "${outputPath}"`;

      this.logger.debug(`Generating thumbnail: ${command}`);

      const execAsync = promisify(exec);
      await execAsync(command);
    } catch (error) {
      this.logger.error(
        `Failed to extract thumbnail: ${(error as Error).message}`,
      );
      throw error;
    }
  }

  /**
   * Extract audio track from video file
   *
   * @param videoPath - Absolute path to video file
   * @param outputPath - Absolute path where audio should be saved (e.g. .mp3 or .wav)
   */
  async extractAudio(videoPath: string, outputPath: string): Promise<void> {
    try {
      // ffmpeg -i <videoPath> -vn -acodec libmp3lame -q:a 2 <outputPath>
      // -vn: disable video recording
      // -acodec libmp3lame: use mp3 codec
      // -q:a 2: variable bit rate (VBR) quality level 2 (approx 190kbps)

      const command = `ffmpeg -i "${videoPath}" -vn -acodec libmp3lame -q:a 2 -y "${outputPath}"`;

      this.logger.debug(`Extracting audio: ${command}`);

      const execAsync = promisify(exec);
      await execAsync(command);
    } catch (error) {
      this.logger.error(`Failed to extract audio: ${(error as Error).message}`);
      throw error;
    }
  }
}
