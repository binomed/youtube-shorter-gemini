---
name: FFmpeg Media Processing
description: Orchestrating FFmpeg for video analysis, segmentation, and rendering in the YouTube-Shorter-Gemini project
---

# FFmpeg Custom Skill

## When to Use This Skill

Use this skill when working with ANY media processing in `apps/back/src/modules/processing/`. This includes:
- Extracting video metadata (duration, resolution, framerate)
- Splitting videos into segments
- Concatenating segments into final renders
- Extracting audio tracks
- Generating vertical (9:16) video outputs
- Real-time progress monitoring

## Core Principles

### 1. Non-Blocking Execution
- **NEVER** use `execSync` - it blocks the Node.js event loop
- **ALWAYS** use `spawn` for async, non-blocking execution
- Stream stdout/stderr for progress monitoring
- Use EventEmitters for progress callbacks

### 2. Zero-Persistence Philosophy
- All media processing happens on **temporary files**
- Source files are deleted immediately after processing
- Only metadata is persisted to SQLite
- Final renders are delivered then cleaned up

### 3. Error Resilience
- FFmpeg can fail silently - always check exit codes
- Parse stderr for actual errors (ffmpeg logs to stderr by default)
- Implement retry logic for transient failures
- Clean up temp files even on errors (try/finally)

## Mandatory Patterns & Rules

### FFmpeg Service Structure

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

/**
 * Service for orchestrating FFmpeg operations.
 * All methods run FFmpeg in non-blocking mode with progress tracking.
 */
@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);
  private readonly TEMP_DIR = '/tmp/yts-processing';

  constructor() {
    this.ensureTempDir();
  }

  /**
   * Ensure temp directory exists at startup.
   */
  private async ensureTempDir() {
    try {
      await fs.mkdir(this.TEMP_DIR, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create temp dir: ${error.message}`);
    }
  }

  /**
   * Extract video metadata (duration, resolution, framerate).
   * Used during ingestion to populate project metadata.
   * 
   * @param videoPath - Path to video file
   * @returns Metadata object
   */
  async extractMetadata(videoPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-v', 'quiet', // Suppress logs
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
      ];

      const ffprobe = spawn('ffprobe', args);
      let stdout = '';
      let stderr = '';

      ffprobe.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      ffprobe.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffprobe.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`ffprobe failed: ${stderr}`);
          return reject(new Error(`FFprobe exited with code ${code}`));
        }

        try {
          const data = JSON.parse(stdout);
          const videoStream = data.streams.find(s => s.codec_type === 'video');
          
          resolve({
            duration: parseFloat(data.format.duration),
            width: videoStream.width,
            height: videoStream.height,
            framerate: eval(videoStream.r_frame_rate), // e.g., "30/1" -> 30
            codec: videoStream.codec_name,
          });
        } catch (error) {
          reject(new Error(`Failed to parse ffprobe output: ${error.message}`));
        }
      });
    });
  }

  /**
   * Split video into segments based on timestamps.
   * Uses stream copy for fast, lossless splitting.
   * 
   * @param inputPath - Source video file
   * @param segments - Array of {startTime, endTime} in seconds
   * @param onProgress - Callback for progress updates (0-100)
   * @returns Array of temp file paths for each segment
   */
  async splitVideoIntoSegments(
    inputPath: string,
    segments: Array<{ startTime: number; endTime: number }>,
    onProgress?: (percentage: number) => void,
  ): Promise<string[]> {
    const outputPaths: string[] = [];
    const totalSegments = segments.length;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const outputPath = path.join(
        this.TEMP_DIR,
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

  /**
   * Extract a single segment using stream copy (fast, no re-encoding).
   */
  private async extractSegment(
    inputPath: string,
    outputPath: string,
    startTime: number,
    endTime: number,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const duration = endTime - startTime;

      const args = [
        '-ss', startTime.toString(), // Seek to start
        '-i', inputPath,
        '-t', duration.toString(), // Duration
        '-c', 'copy', // Stream copy (no re-encode)
        '-avoid_negative_ts', 'make_zero',
        '-y', // Overwrite output
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';

      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`FFmpeg segment extraction failed: ${stderr}`);
          return reject(new Error(`FFmpeg exited with code ${code}`));
        }
        resolve();
      });
    });
  }

  /**
   * Concatenate multiple video segments into a single output.
   * Re-encodes to vertical format (9:16) for YouTube Shorts.
   * 
   * @param segmentPaths - Array of segment file paths
   * @param outputPath - Final output file path
   * @param onProgress - Progress callback (0-100)
   */
  async concatenateAndRenderVertical(
    segmentPaths: string[],
    outputPath: string,
    onProgress?: (percentage: number, message: string) => void,
  ): Promise<void> {
    // Create concat file list
    const concatListPath = path.join(this.TEMP_DIR, `concat-${Date.now()}.txt`);
    const concatContent = segmentPaths
      .map((p) => `file '${p}'`)
      .join('\n');
    
    await fs.writeFile(concatListPath, concatContent);

    try {
      await this.renderVerticalVideo(concatListPath, outputPath, onProgress);
    } finally {
      // Cleanup concat file
      await fs.unlink(concatListPath).catch(() => {});
    }
  }

  /**
   * Render vertical video (1080x1920) from concat list.
   * Monitors progress by parsing FFmpeg's time output.
   */
  private async renderVerticalVideo(
    concatListPath: string,
    outputPath: string,
    onProgress?: (percentage: number, message: string) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'concat',
        '-safe', '0',
        '-i', concatListPath,
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2',
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-crf', '23', // Quality (lower = better, 18-28 typical)
        '-c:a', 'aac',
        '-b:a', '128k',
        '-movflags', '+faststart', // Enable streaming
        '-y',
        outputPath,
      ];

      const ffmpeg = spawn('ffmpeg', args);
      let stderr = '';
      let duration: number | null = null;

      ffmpeg.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;

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
          
          if (onProgress) {
            onProgress(percentage, `Rendering: ${currentTime}s / ${duration}s`);
          }
        }
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          this.logger.error(`FFmpeg render failed: ${stderr}`);
          return reject(new Error(`FFmpeg exited with code ${code}`));
        }
        
        if (onProgress) {
          onProgress(100, 'Render complete');
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
   * Extract audio track from video.
   * Used for separate audio processing/analysis.
   * 
   * @param videoPath - Input video file
   * @returns Path to extracted audio file (WAV format)
   */
  async extractAudio(videoPath: string): Promise<string> {
    const outputPath = path.join(this.TEMP_DIR, `audio-${Date.now()}.wav`);

    return new Promise((resolve, reject) => {
      const args = [
        '-i', videoPath,
        '-vn', // No video
        '-acodec', 'pcm_s16le', // Uncompressed WAV
        '-ar', '44100', // Sample rate
        '-ac', '2', // Stereo
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
          this.logger.error(`Audio extraction failed: ${stderr}`);
          return reject(new Error(`FFmpeg exited with code ${code}`));
        }
        resolve(outputPath);
      });
    });
  }

  /**
   * Cleanup temp directory (call periodically or on shutdown).
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.TEMP_DIR);
      
      for (const file of files) {
        const filePath = path.join(this.TEMP_DIR, file);
        await fs.unlink(filePath).catch((err) =>
          this.logger.warn(`Failed to delete ${file}: ${err.message}`)
        );
      }
      
      this.logger.log(`Cleaned up ${files.length} temp files`);
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
    }
  }
}

/**
 * Video metadata structure returned by extractMetadata.
 */
export interface VideoMetadata {
  duration: number; // seconds
  width: number;
  height: number;
  framerate: number;
  codec: string;
}
```

### Integration with SQL-Queue

Use FFmpeg service within a job processor:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Job } from '../../entities/job.entity';
import { FfmpegService } from './ffmpeg.service';
import { JobService } from '../jobs/job.service';

@Injectable()
export class RenderProcessor {
  private readonly logger = new Logger(RenderProcessor.name);

  constructor(
    private readonly ffmpegService: FfmpegService,
    private readonly jobService: JobService,
  ) {}

  /**
   * Listen for render job events and execute.
   */
  @OnEvent('job.process.render')
  async handleRenderJob(job: Job) {
    const payload = JSON.parse(job.payload);
    const { segmentPaths, outputPath } = payload;

    try {
      await this.ffmpegService.concatenateAndRenderVertical(
        segmentPaths,
        outputPath,
        (percentage, message) => {
          // Update job progress in DB and SSE
          this.jobService.updateProgress(job.id, percentage, message);
        },
      );

      await this.jobService.completeJob(job.id);
      this.logger.log(`Render job ${job.id} completed`);

    } catch (error) {
      await this.jobService.failJob(job.id, error.message);
      this.logger.error(`Render job ${job.id} failed: ${error.message}`);
    }
  }
}
```

## Common Pitfalls

### ❌ DON'T: Use synchronous execution
```typescript
// BAD: Blocks event loop
const result = execSync('ffmpeg -i input.mp4 output.mp4');
```

### ✅ DO: Use spawn with async/await
```typescript
// GOOD: Non-blocking
const ffmpeg = spawn('ffmpeg', ['-i', 'input.mp4', 'output.mp4']);
await new Promise((resolve) => ffmpeg.on('close', resolve));
```

### ❌ DON'T: Ignore stderr
```typescript
// BAD: FFmpeg logs to stderr by default
ffmpeg.stdout.on('data', console.log);
```

### ✅ DO: Parse stderr for progress
```typescript
// GOOD: Progress info is in stderr
ffmpeg.stderr.on('data', (data) => {
  const match = data.toString().match(/time=(\d+)/);
  if (match) updateProgress(match[1]);
});
```

### ❌ DON'T: Forget cleanup on errors
```typescript
// BAD: Temp files leak on error
await ffmpegService.render(input, output);
```

### ✅ DO: Always cleanup with try/finally
```typescript
// GOOD: Cleanup guaranteed
try {
  await ffmpegService.render(input, output);
} finally {
  await fs.unlink(tempFile).catch(() => {});
}
```

## Performance Targets

From architecture requirements:
- **Render time:** < 60s for a 60s segment
- **Metadata extraction:** < 2s
- **Segment splitting:** < 5s per segment (stream copy)

### Optimization Tips

1. **Use `-c copy` when possible** (no re-encoding)
2. **Preset choice:**
   - `ultrafast`: For preview/testing
   - `medium`: Production default (good balance)
   - `slow`: Higher quality, 2x slower
3. **Hardware acceleration (optional):**
   ```typescript
   args.push('-hwaccel', 'videotoolbox'); // macOS
   ```

## Testing Requirements

### Unit Tests

```typescript
describe('FfmpegService', () => {
  let service: FfmpegService;

  it('should extract metadata from valid video', async () => {
    const metadata = await service.extractMetadata('test-video.mp4');
    
    expect(metadata.duration).toBeGreaterThan(0);
    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBe(1080);
  });

  it('should handle invalid video gracefully', async () => {
    await expect(
      service.extractMetadata('invalid.mp4')
    ).rejects.toThrow();
  });

  it('should cleanup temp files after processing', async () => {
    const result = await service.extractSegment(/* ... */);
    await service.cleanupTempFiles();
    
    // Verify temp dir is empty
    const files = await fs.readdir(service.TEMP_DIR);
    expect(files.length).toBe(0);
  });
});
```

## Advanced ASS Subtitle Styling Tricks

When rendering `.ass` subtitles via FFmpeg, styling background boxes can cause severe overlapping rendering bugs on multiline text.

### Fixing Multiline Transparent Background Overlaps (`BorderStyle`)
- **The Problem**: Using `BorderStyle=3` (Opaque Box) paints an individual rectangular background for *every single line of text*. When the text is multiline (`\N`) and has transparency (e.g., `&H80000000&`), the boxes of adjacent lines overlap in the center, causing vertical dark blending artifacts. Furthermore, in `BorderStyle=3` (depending on the renderer), `OutlineColour` may unexpectedly act as the box fill, and `BackColour` as the box drop shadow.
- **The Solution (BorderStyle 4)**: To fix this gracefully without manual `\clip` calculations or complex scaling/outlining hacks, use `BorderStyle=4` (Uniform Background). 
  - `BorderStyle 4` natively treats the entire multiline text block as a single unified bounding box.
  - It maps the `BackColour` (7th parameter) correctly to the box fill.
  - Due to ASS format quirks, `BorderStyle 4` does NOT natively support outlining or text drop shadows on the text itself.
- **Best Practice for UI Fidelity**: To replicate modern web UI (background box + text drop shadow), separate your subtitles into **two synchronously overlaid layers**:
  1. **Layer 0 (Background)**: Uses `BorderStyle 4`, a transparent `PrimaryColour`/`SecondaryColour` (hiding the text), and your desired `BackColour`. Ensure `Outline` is 0.
  2. **Layer 1 (Text & Shadow)**: Uses `BorderStyle 1` (Outline/Shadow), your desired `PrimaryColour` (white text), a transparent `OutlineColour`, and your drop shadow color as the `BackColour`. Ensure `Shadow` is >0.

### Border Radius Limitations
The Advanced SubStation Alpha (.ass) format **does not natively support `border-radius`** or rounded corners on its background bounding boxes (`BorderStyle 3` or `4`).
- While `BorderStyle=1` with an extreme `Outline` value can create rounded "bubbles" mathematically wrapping the words, it cannot produce a uniform *rectangular* rounded box and will cause severe alpha blending overlaps on multiline text.
- Creating a true rounded rectangle requires injecting manual ASS vector drawing commands (e.g., `{\p1}m 0 0 l 100 0...{\p0}`). However, since vector shapes in ASS have fixed pixel dimensions, they do not dynamically expand or wrap around generated dynamic text lengths natively.
- **Conclusion**: For dynamic FFmpeg subtitles, the background box (`BorderStyle 4`) will invariably feature sharp, 90-degree corners.

## FFmpeg Cheat Sheet

| Task | Command Pattern |
|------|-----------------|
| Extract metadata | `ffprobe -v quiet -print_format json -show_format -show_streams input.mp4` |
| Cut segment | `ffmpeg -ss START -i input.mp4 -t DURATION -c copy output.mp4` |
| Vertical resize | `ffmpeg -i input.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" output.mp4` |
| Extract audio | `ffmpeg -i input.mp4 -vn -acodec pcm_s16le output.wav` |
| Concat videos | `ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4` |

## Checklist for FFmpeg Operations

- [ ] Use `spawn`, never `execSync`
- [ ] Parse stderr for progress/errors
- [ ] Implement progress callbacks for jobs > 5s
- [ ] Cleanup temp files in try/finally blocks
- [ ] Check exit code (0 = success)
- [ ] Test with various video formats/codecs
- [ ] Handle missing FFmpeg binary gracefully
- [ ] Log errors with context (file paths, args)

## Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Zero-Persistence)
