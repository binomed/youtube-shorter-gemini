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
    width?: number,
  ): Promise<void> {
    try {
      const vf = width ? `-vf scale=${width}:-1` : '';
      const command = `ffmpeg -ss ${timestamp} -i "${videoPath}" ${vf} -vframes 1 -q:v 2 -y "${outputPath}"`;

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
    await fs.mkdir(TEMP_DIR, { recursive: true }).catch(() => {});
    const outputPaths: string[] = [];
    const totalSegments = segments.length;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const outputPath = path.join(TEMP_DIR, `segment-${Date.now()}-${i}.mp4`);

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

  /**
   * Extract multiple frames at regular intervals for AI analysis.
   */
  async extractFrames(
    videoPath: string,
    outputPathPattern: string,
    interval: number,
    totalFrames: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // ffmpeg -i <video> -vf "select='not(mod(n, <interval>))',scale=512:-1" -vframes <total> -q:v 5 -y <pattern>
      const args = [
        '-i',
        videoPath,
        '-vf',
        `select='not(mod(n,${interval}))',scale=512:-1`,
        '-vframes',
        totalFrames.toString(),
        '-q:v',
        '5',
        '-y',
        outputPathPattern,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Frame extraction failed with code ${code}`));
      });
      ffmpeg.on('error', reject);
    });
  }

  /**
   * Extract audio segment specifically formatted for Demucs (WAV, 44.1kHz).
   */
  async extractAudioForStems(
    videoPath: string,
    outputPath: string,
    startTime: number,
    duration: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-ss',
        startTime.toString(),
        '-i',
        videoPath,
        '-t',
        duration.toString(),
        '-vn',
        '-acodec',
        'pcm_s16le',
        '-ar',
        '44100',
        '-ac',
        '2',
        '-y',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else
          reject(new Error(`Stem audio extraction failed with code ${code}`));
      });
      ffmpeg.on('error', reject);
    });
  }

  public async extractSegment(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const duration = endTime - startTime;

      const args = [
        '-i',
        inputPath,
        '-ss',
        startTime.toString(),
        '-t',
        duration.toString(),
        '-c:v',
        'libx264',
        '-crf',
        '18', // High quality for intermediate segments
        '-preset',
        'ultrafast', // Speed up intermediate step
        '-c:a',
        'aac',
        '-b:a',
        '192k',
        '-y',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(
            `FFmpeg segment extraction failed: ${stderr.substring(stderr.length - 1000)}`,
          );
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
      layoutData?: Array<{ layoutMode: 'fill' | 'fullscreen'; centerX: number }>;
      onProgress?: (percentage: number, message: string) => void;
    },
  ): Promise<void> {
    await this.renderVerticalVideo(segmentPaths, outputPath, options);
  }

  private async renderVerticalVideo(
    segmentPaths: string[],
    outputPath: string,
    options?: {
      subtitleAssPath?: string;
      vocalsPath?: string;
      musicPath?: string;
      layoutData?: Array<{ layoutMode: 'fill' | 'fullscreen'; centerX: number }>;
      onProgress?: (percentage: number, message: string) => void;
    },
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['-v', 'error', '-y'];

      // 1. Inputs: All segments + Optional Stems
      for (const p of segmentPaths) {
        args.push('-i', p);
      }

      const stemStartIndex = segmentPaths.length;
      if (options?.vocalsPath) {
        args.push('-i', options.vocalsPath);
      }
      if (options?.musicPath) {
        args.push('-i', options.musicPath);
      }

      // 2. Complex Filtergraph
      let filterComplex = '';
      const processedVideoLabels: string[] = [];

      // Process each video segment input
      for (let i = 0; i < segmentPaths.length; i++) {
        const layout = options?.layoutData?.[i] || {
          layoutMode: 'fill',
          centerX: 0.5,
        };
        const inputLabel = `${i}:v`;
        const outputLabel = `v${i}`;

        if (layout.layoutMode === 'fullscreen') {
          // Fullscreen: Blurred background + Scaled foreground
          filterComplex += `[${inputLabel}]split[bg${i}][fg${i}];`;
          filterComplex += `[bg${i}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=15:5,colorchannelmixer=rr=0.8:gg=0.8:bb=0.8[bgout${i}];`;
          filterComplex += `[fg${i}]scale=1080:1920:force_original_aspect_ratio=decrease[fgout${i}];`;
          filterComplex += `[bgout${i}][fgout${i}]overlay=(W-w)/2:(H-h)/2[${outputLabel}];`;
        } else {
          // Fill: Smart crop based on centerX
          // x calculation: (total_width - cropped_width) * centerX
          // Since we scale to height first, total_width is in_w * (1920 / in_h)
          // But it's easier to scale to fill and then crop.
          filterComplex += `[${inputLabel}]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920:'(in_w-1080)*${layout.centerX}':0[${outputLabel}];`;
        }
        processedVideoLabels.push(`[${outputLabel}]`);
      }

      // Concatenate processed segments
      filterComplex += `${processedVideoLabels.join('')}concat=n=${segmentPaths.length}:v=1:a=0[v_concat];`;

      // Video Post-processing (Subtitles)
      let finalVideoLabel = '[v_concat]';
      if (options?.subtitleAssPath) {
        const filterPath = options.subtitleAssPath.replace(/'/g, "'\\\\''");
        const cwd = process.cwd();
        const appBackPath = cwd.endsWith('apps/back')
          ? cwd
          : path.join(cwd, 'apps', 'back');
        const fontsDir = path
          .join(appBackPath, 'assets', 'fonts')
          .replace(/'/g, "'\\\\''");

        filterComplex += `[v_concat]subtitles=filename='${filterPath}':fontsdir='${fontsDir}'[v_final];`;
        finalVideoLabel = '[v_final]';
      }

      // Audio mixing
      let finalAudioLabel = '0:a?'; // Default to first segment audio if no stems
      const audioStreamsToMix: string[] = [];
      
      if (options?.vocalsPath || options?.musicPath) {
          if (options.vocalsPath) audioStreamsToMix.push(`[${stemStartIndex}:a]`);
          const musicIndex = options.vocalsPath ? stemStartIndex + 1 : stemStartIndex;
          if (options.musicPath) audioStreamsToMix.push(`[${musicIndex}:a]`);
          
          filterComplex += `${audioStreamsToMix.join('')}amix=inputs=${audioStreamsToMix.length}:duration=longest[a_final]`;
          finalAudioLabel = '[a_final]';
      } else {
          // If no stems, we need to concatenate audio from segments too
          const audioInputs = segmentPaths.map((_, i) => `[${i}:a]`).join('');
          filterComplex += `${audioInputs}concat=n=${segmentPaths.length}:v=0:a=1[a_concat]`;
          finalAudioLabel = '[a_concat]';
      }

      args.push('-filter_complex', filterComplex);
      args.push('-map', finalVideoLabel);
      args.push('-map', finalAudioLabel);

      // 3. Output formats
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '23',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart', // For web streaming compatibility
        outputPath,
      );

      this.logger.debug(`Rendering vertical video: ffmpeg ${args.join(' ')}`);
      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      let duration: number | null = null;

      ffmpeg.stderr.on('data', (data: Buffer) => {
        const output = data.toString();
        stderr += output;

        // Log ALL output to server console for debugging if debug mode is on
        if (args.includes('debug')) {
          this.logger.log(`FFmpeg Debug: ${output.trim()}`);
        }

        // Extract total duration
        if (!duration) {
          const durationMatch = output.match(
            /Duration: (\d{2}):(\d{2}):(\d{2})\.\d+/,
          );
          if (durationMatch) {
            const [, hours, minutes, seconds] = durationMatch;
            duration =
              parseInt(hours) * 3600 +
              parseInt(minutes) * 60 +
              parseInt(seconds);
          }
        }

        // Extract current time
        const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})\.\d+/);
        if (timeMatch && duration) {
          const [, hours, minutes, seconds] = timeMatch;
          const currentTime =
            parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds);
          const percentage = Math.min(
            Math.round((currentTime / duration) * 100),
            100,
          );

          if (options?.onProgress) {
            options.onProgress(
              percentage,
              `Rendering: ${currentTime}s / ${duration}s`,
            );
          }
        }
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(
            `FFmpeg render failed: ${stderr.substring(stderr.length - 1000)}`,
          );
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
