// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

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

  constructor(private readonly configService: ConfigService) { }

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

  async splitVideoIntoSegments(
    inputPath: string,
    segments: Array<{ startTime: number; endTime: number }>,
    onProgress?: (percentage: number) => void,
  ): Promise<string[]> {
    const TEMP_DIR = '/tmp/yts-processing';
    await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => { });
    const outputPaths: string[] = [];
    const totalSegments = segments.length;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const outputPath = path.join(
        TEMP_DIR,
        `segment-${Date.now()}-${i}.mp4`,
      );

      await this.extractSegment(
        inputPath,
        outputPath,
        segment.startTime,
        segment.endTime,
      );

      outputPaths.push(outputPath);

      if (onProgress) {
        const progress = Math.round(((i + 1) / totalSegments) * 100);
        onProgress(progress);
      }
    }

    return outputPaths;
  }

  private async extractSegment(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const duration = endTime - startTime;

      const args = [
        '-ss', startTime.toString(),
        '-i', inputPath,
        '-t', duration.toString(),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        '-y',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`FFmpeg segment extraction failed: ${stderr.substring(stderr.length - 1000)}`);
          return reject(new Error(`FFmpeg exited with code ${code}`));
        }
        resolve();
      });

      ffmpeg.on('error', (error) => {
        this.logger.error(`FFmpeg spawn error: ${error.message}`);
        reject(error);
      });
    });
  }

  /**
   * Concatenate multiple video segments into a single output.
   * Re-encodes to vertical format (9:16) for YouTube Shorts.
   * Supports hardcoding ASS subtitles and mixing audio stems.
   *
   * @param segmentPaths - Array of segment file paths
   * @param outputPath - Final output file path
   * @param options - Additional options for subtitles and mixing
   */
  async concatenateAndRenderVertical(
    segmentPaths: string[],
    outputPath: string,
    options?: {
      subtitleAssPath?: string;
      vocalsPath?: string;
      musicPath?: string;
      onProgress?: (percentage: number, message: string) => void;
    },
  ): Promise<void> {
    const TEMP_DIR = '/tmp/yts-processing'; // Shared temp directory mapped by OS
    await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => { });

    // Create concat file list
    const concatListPath = path.join(TEMP_DIR, `concat-${Date.now()}.txt`);
    // Format required for ffmpeg concat demuxer
    const concatContent = segmentPaths
      .map((p) => `file '${p}'`)
      .join('\n');

    await fs.writeFile(concatListPath, concatContent);

    try {
      await this.renderVerticalVideo(concatListPath, outputPath, options);
    } finally {
      // Cleanup concat file
      await fs.unlink(concatListPath).catch(() => { });
    }
  }

  private async renderVerticalVideo(
    concatListPath: string,
    outputPath: string,
    options?: {
      subtitleAssPath?: string;
      vocalsPath?: string;
      musicPath?: string;
      onProgress?: (percentage: number, message: string) => void;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['-v', 'error', '-y'];

      // 1. Inputs
      args.push('-f', 'concat', '-safe', '0', '-i', concatListPath);

      if (options?.vocalsPath) {
        args.push('-i', options.vocalsPath);
      }
      if (options?.musicPath) {
        args.push('-i', options.musicPath);
      }

      // 2. Complex Filtergraph for video and audio
      // Video scale and pad
      const videoFilters = [
        'scale=1080:1920:force_original_aspect_ratio=increase',
        'crop=1080:1920'
      ];

      if (options?.subtitleAssPath) {
        // On Mac, /tmp is a symlink to /private/tmp. Some FFmpeg builds prefer the real path.
        // Also, we use a single level of escaping for the filename.
        const filterPath = options.subtitleAssPath.replace(/'/g, "'\\\\''");
        // Embed the custom fonts directory (where we downloaded Montserrat) to ensure identical rendering
        // Fix duplicate apps/back path due to CWD scoping
        const cwd = process.cwd();
        const appBackPath = cwd.endsWith('apps/back') ? cwd : path.join(cwd, 'apps', 'back');
        const fontsDir = path.join(appBackPath, 'assets', 'fonts').replace(/'/g, "'\\\\''");

        videoFilters.push(`subtitles=filename='${filterPath}':fontsdir='${fontsDir}'`);
      }

      // Video mapped out as 'v'
      let filterComplex = `[0:v]${videoFilters.join(',')}[v]`;

      this.logger.log(`FFmpeg Command Args: ffmpeg ${args.join(' ')} -filter_complex "${filterComplex}" -map "[v]" ...`);

      const audioStreamsToMix: string[] = [];
      if (options?.vocalsPath) {
        audioStreamsToMix.push('[1:a]');
      }
      if (options?.musicPath) {
        audioStreamsToMix.push(options?.vocalsPath ? '[2:a]' : '[1:a]');
      }

      if (audioStreamsToMix.length > 0) {
        // Mix all audio inputs equally
        filterComplex += `; ${audioStreamsToMix.join('')}amix=inputs=${audioStreamsToMix.length}:duration=longest[a]`;
      }

      args.push('-filter_complex', filterComplex);
      args.push('-map', '[v]');
      if (audioStreamsToMix.length > 0) {
        args.push('-map', '[a]');
      } else {
        // map original audio if no stems are used
        args.push('-map', '0:a?');
      }

      // 3. Output formats
      args.push(
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart', // For web streaming compatibility
        outputPath,
      );

      this.logger.debug(`Rendering vertical video: ffmpeg ${args.join(' ')}`);
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      let duration: number | null = null;

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;

        // Log ALL output to server console for debugging if debug mode is on
        if (args.includes('debug')) {
          this.logger.log(`FFmpeg Debug: ${output.trim()}`);
        }

        // Extract total duration
        if (!duration) {
          const durationMatch = output.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.\d+/);
          if (durationMatch) {
            const [, hours, minutes, seconds] = durationMatch;
            duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          }
        }

        // Extract current time
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.\d+/);
        if (timeMatch && duration) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          const percentage = Math.min(Math.round((currentTime / duration) * 100), 100);

          if (options?.onProgress) {
            options.onProgress(percentage, `Rendering: ${currentTime}s / ${duration}s`);
          }
        }
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`FFmpeg render failed: ${stderr.substring(stderr.length - 1000)}`);
          return reject(new Error(`FFmpeg exited with code ${code}`));
        }

        if (options?.onProgress) {
          options.onProgress(100, 'Render complete');
        }

        resolve();
      });

      ffmpeg.on('error', (error) => {
        this.logger.error(`FFmpeg spawn error: ${error.message}`);
        reject(error);
      });
    });
  }
}
