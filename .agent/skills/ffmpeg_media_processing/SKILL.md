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

## ASS Subtitle System — Complete Reference

This section covers everything needed to programmatically generate, style, and burn-in ASS subtitles via FFmpeg in this project. The reference implementation lives in `apps/back/src/modules/processing/export.service.ts`.

---

### ASS File Structure

Every `.ass` file has three mandatory sections:

```
[Script Info]
ScriptType: v4.00+
PlayResX: 1080          ; Match export width
PlayResY: 1920          ; Match export height (vertical 9:16)
ScaledBorderAndShadow: yes
WrapStyle: 1            ; 0=smart, 1=end-of-line, 2=no wrap, 3=smart+lower

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Roboto-Bold,77,&H00FFFFFF&,&H000000FF&,&H00000000&,&H80000000&,-1,0,0,0,100,100,0,0,4,0,0,2,54,54,384,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Hello world
```

**Key rules:**
- `PlayResX/Y` MUST match your export resolution for pixel-accurate rendering
- `ScaledBorderAndShadow: yes` ensures all sizes scale with resolution
- `WrapStyle: 1` is preferred — it wraps at `\N` hard breaks and at margins
- Newlines in subtitle text use `\N` (hard break) or `\n` (soft break)

---

### Color Conversion: CSS → ASS Format

ASS uses the format `&HAABBGGRR&` (Alpha-Blue-Green-Red), which is **inverted** from CSS.
Alpha: `00` = fully opaque, `FF` = fully transparent (opposite of CSS).

```typescript
/**
 * Convert any CSS color to ASS &HAABBGGRR& format.
 * Supports: #RGB, #RRGGBB, #RRGGBBAA, rgba(), rgb(), 'transparent'
 */
const toAssColor = (cssColor: string, defaultAss: string): string => {
  if (!cssColor) return defaultAss;

  let r = 255, g = 255, b = 255, a = 0; // a=0 is opaque in ASS

  if (cssColor.startsWith('#')) {
    const hex = cssColor.substring(1);
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else if (hex.length === 8) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
      a = 255 - parseInt(hex.substring(6, 8), 16); // Invert for ASS
    }
  } else if (cssColor.startsWith('rgba') || cssColor.startsWith('rgb')) {
    const match = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      r = parseInt(match[1], 10);
      g = parseInt(match[2], 10);
      b = parseInt(match[3], 10);
      a = Math.round(255 * (1 - (match[4] !== undefined ? parseFloat(match[4]) : 1)));
    }
  } else if (cssColor === 'transparent') {
    return '&HFFFFFFFF&'; // Fully transparent white
  }

  // ASS: &H AA BB GG RR &
  const aa = a.toString(16).padStart(2, '0').toUpperCase();
  const bb = b.toString(16).padStart(2, '0').toUpperCase();
  const gg = g.toString(16).padStart(2, '0').toUpperCase();
  const rr = r.toString(16).padStart(2, '0').toUpperCase();
  return `&H${aa}${bb}${gg}${rr}&`;
};
```

**Quick reference:**

| CSS Color | ASS Equivalent |
|-----------|---------------|
| `#FFFFFF` (white) | `&H00FFFFFF&` |
| `#000000` (black) | `&H00000000&` |
| `#FF0000` (red) | `&H000000FF&` ← Note BGR swap |
| `rgba(0,0,0,0.5)` | `&H80000000&` ← 50% transparent |
| `transparent` | `&HFFFFFFFF&` |

---

### Resolution Scaling: UI → Export

The frontend editor uses a reference viewport height (typically ~1000px). The export renders at 1920px height. All pixel-based values (font size, outline, shadow, margins) must be proportionally scaled.

```typescript
const UI_REFERENCE_HEIGHT = 1000;
const EXPORT_HEIGHT = 1920;
const scaleFactor = EXPORT_HEIGHT / UI_REFERENCE_HEIGHT; // 1.92

const fontSize = Math.round((style.fontSize || 40) * scaleFactor);  // 40px → 77px
const borderWidth = Math.round((style.borderWidth || 3) * scaleFactor); // 3px → 6px
const shadowDepth = Math.round(3 * scaleFactor);                       // 3px → 6px

// Margins: 5% of 1080px width = 54px each side (for 90% max-width parity)
const marginLR = 54;
// Bottom margin: 20% of 1920px = 384px base, adjusted by user offset
const baseMarginBottom = 384;
const marginV = Math.max(10, baseMarginBottom - Math.round((style.positionY || 0) * scaleFactor));
```

---

### Font Mapping & `fontsdir` Configuration

FFmpeg's `libass` resolves font names against system fonts or a specified directory.
In this project, custom fonts are bundled in `apps/back/assets/fonts/`.

```typescript
// 1. Map CSS font-family to physical TTF name
const FONT_MAP: Record<string, string> = {
  'Montserrat': 'Montserrat',
  'Oswald': 'Oswald',
  'Impact': 'Impact',
  'Roboto': 'Roboto',
};

let fontName = 'Roboto-Bold'; // Default fallback
for (const [key, value] of Object.entries(FONT_MAP)) {
  if (rawFontName.includes(key)) { fontName = value; break; }
}

// 2. Configure fontsdir in FFmpeg filter
const fontsDir = path.join(appBackPath, 'assets', 'fonts');
// Escape single quotes for FFmpeg filter syntax:
const escaped = fontsDir.replace(/'/g, "'\\\\''");
filterComplex += `[v_concat]subtitles=filename='${assPath}':fontsdir='${escaped}'[v_final];`;
```

**Rule:** When adding new fonts, place the `.ttf`/`.otf` file in `assets/fonts/` **and** add a mapping entry.

---

### Dual-Layer Rendering Pattern

To replicate modern UI (background box + text shadow) faithfully in ASS:

```
; Layer 0 — Background box only (text invisible via transparent PrimaryColour)
Style: BgLayer,Roboto-Bold,77,&HFFFFFFFF&,&HFFFFFFFF&,&HFFFFFFFF&,&H80000000&,-1,0,0,0,100,100,0,0,4,38,0,2,54,54,384,1

; Layer 1 — Text with shadow (no background box)
Style: TextLayer,Roboto-Bold,77,&H00FFFFFF&,&H000000FF&,&HFFFFFFFF&,&H33000000&,-1,0,0,0,100,100,0,0,1,0,6,2,54,54,384,1
```

Then emit **two synchronized Dialogue lines** per subtitle:
```typescript
for (const sub of subtitles) {
  const start = formatAssTime(sub.startTime);
  const end = formatAssTime(sub.endTime);
  const text = sub.text.replace(/\n/g, '\\N');

  if (!isTransparentBox) {
    ass += `Dialogue: 0,${start},${end},BgLayer,,0,0,0,,${text}\n`;
  }
  ass += `Dialogue: 1,${start},${end},TextLayer,,0,0,0,,${text}\n`;
}
```

---

### Known ASS/libass Rendering Limitations

#### Fixing Multiline Transparent Background Overlaps (`BorderStyle`)
- **The Problem**: `BorderStyle=3` (Opaque Box) paints an individual background for *every line*. With transparency (e.g., `&H80000000&`), adjacent line boxes overlap, causing dark blending artifacts. In `BorderStyle=3`, `OutlineColour` may unexpectedly act as the box fill, and `BackColour` as its shadow.
- **The Solution**: Use `BorderStyle=4` (Uniform Background). It treats the entire multiline block as a single bounding box and maps `BackColour` correctly to the fill.
- **Caveat**: `BorderStyle 4` does NOT support text outlining or drop shadows natively — hence the dual-layer pattern above.

#### Border Radius Limitations
The `.ass` format **does not support `border-radius`** on background boxes.
- `BorderStyle=1` with extreme `Outline` creates rounded "bubbles" but not rectangular rounded boxes, and causes alpha overlap on multiline.
- ASS vector drawing (`{\p1}m 0 0 l 100 0...{\p0}`) gives sharp control but cannot dynamically resize around text.
- **Conclusion**: Background boxes will always have sharp 90° corners.

#### Line Spacing Limitations
ASS **does not support CSS-style `line-height`**. The `Spacing` parameter controls horizontal *letter* spacing only.
- `libass` derives vertical gap strictly from font internal metrics (Ascender/Descender).
- Hacks using invisible scaled text (`\N{\fsX}.\N\r`) break on automatic soft-wrapping.
- **Conclusion**: Avoid custom `line-height` in the UI. Use browser default (`normal`/`1.15`) to match `libass` rendering.

---

### ASS Override Tags — Complete Reference

These tags are placed inside `{}` in the `Text` field of a Dialogue line. They affect all text following them until overridden or reset with `\r`.

#### Text Formatting

| Tag | Effect | Example |
|-----|--------|---------|
| `\b1` / `\b0` | Bold on/off | `{\b1}Bold text{\b0}` |
| `\i1` / `\i0` | Italic on/off | `{\i1}Italic{\i0}` |
| `\u1` / `\u0` | Underline on/off | `{\u1}Underlined{\u0}` |
| `\s1` / `\s0` | Strikeout on/off | `{\s1}Struck{\s0}` |
| `\fs<size>` | Font size (points) | `{\fs48}Big text` |
| `\fn<name>` | Font name | `{\fnImpact}Impact font` |
| `\fscx<pct>` | Horizontal scale % | `{\fscx200}Wide text` |
| `\fscy<pct>` | Vertical scale % | `{\fscy50}Squished` |
| `\fsp<px>` | Letter spacing (px) | `{\fsp5}S p a c e d` |
| `\r` | Reset to line style | `{\b1}Bold {\r}Normal` |
| `\r<StyleName>` | Reset to named style | `{\rTextLayer}` |

#### Colors & Transparency

| Tag | Effect | Example |
|-----|--------|---------|
| `\c&HBBGGRR&` / `\1c` | Primary (fill) color | `{\c&H0000FF&}Red text` |
| `\2c&HBBGGRR&` | Secondary color (karaoke pre-highlight) | `{\2c&HFFFFFF&}` |
| `\3c&HBBGGRR&` | Outline color | `{\3c&H000000&}` |
| `\4c&HBBGGRR&` | Shadow color | `{\4c&H000000&}` |
| `\alpha&HAA&` | Global alpha (all components) | `{\alpha&H80&}` 50% transparent |
| `\1a&HAA&` | Primary alpha only | `{\1a&HFF&}` invisible fill |
| `\2a&HAA&` | Secondary alpha only | |
| `\3a&HAA&` | Outline alpha only | `{\3a&H80&}` semi-transparent outline |
| `\4a&HAA&` | Shadow alpha only | |

> **Alpha values:** `&H00&` = fully opaque, `&HFF&` = fully transparent.

#### Border & Shadow

| Tag | Effect | Example |
|-----|--------|---------|
| `\bord<size>` | Outline thickness | `{\bord4}Thick outline` |
| `\xbord<size>` | Horizontal outline only | `{\xbord4}` |
| `\ybord<size>` | Vertical outline only | `{\ybord4}` |
| `\shad<size>` | Shadow distance | `{\shad3}With shadow` |
| `\xshad<size>` | Horizontal shadow (can be negative) | `{\xshad-3}` |
| `\yshad<size>` | Vertical shadow (can be negative) | `{\yshad5}` |

#### Position & Movement

| Tag | Effect | Example |
|-----|--------|---------|
| `\an<1-9>` | Alignment (numpad layout) | `{\an8}Top center` |
| `\pos(x,y)` | Static position | `{\pos(540,1600)}Centered` |
| `\move(x1,y1,x2,y2)` | Move between points | `{\move(0,960,540,960)}Slide in` |
| `\move(x1,y1,x2,y2,t1,t2)` | Timed move (ms) | `{\move(0,960,540,960,0,300)}` |
| `\org(x,y)` | Rotation origin point | `{\org(540,960)}` |

#### Animation & Effects

| Tag | Effect | Example |
|-----|--------|---------|
| `\t(tags)` | Animate tags over full duration | `{\fscx0\t(\fscx100)}Grow in` |
| `\t(t1,t2,tags)` | Animate between t1-t2 (ms) | `{\t(0,300,\fscx100)}` |
| `\t(t1,t2,accel,tags)` | Animated with acceleration | `{\t(0,500,2,\fs72)}` |
| `\fad(in,out)` | Simple fade in/out (ms) | `{\fad(200,300)}` |
| `\fade(a1,a2,a3,t1,t2,t3,t4)` | Complex 3-stage fade | `{\fade(255,0,255,0,500,2500,3000)}` |
| `\blur<val>` | Gaussian blur | `{\blur2}Blurred text` |
| `\be<val>` | Edge blur | `{\be1}Soft edges` |
| `\frx<deg>` | Rotate around X axis | `{\frx30}Tilted` |
| `\fry<deg>` | Rotate around Y axis | `{\fry45}Perspective` |
| `\frz<deg>` / `\fr<deg>` | Rotate around Z axis | `{\frz-10}Angled` |

#### Clipping

| Tag | Effect | Example |
|-----|--------|---------|
| `\clip(x1,y1,x2,y2)` | Show only inside rectangle | `{\clip(0,0,540,1920)}Left half` |
| `\iclip(x1,y1,x2,y2)` | Hide inside rectangle | `{\iclip(200,800,880,1100)}` |
| `\clip(scale,drawing)` | Vector clip mask | `{\clip(1,m 0 0 l 1080 0 1080 960 0 960)}` |

#### Karaoke

| Tag | Effect |
|-----|--------|
| `\k<cs>` | Highlight after duration (centiseconds). Color jumps from Secondary → Primary. |
| `\K<cs>` / `\kf<cs>` | Fill karaoke — smooth left-to-right sweep. |
| `\ko<cs>` | Outline karaoke — highlights outline only. |

---

### Word-by-Word Highlight (TikTok/Reels Style)

Three approaches for highlighting words as they are spoken. All require **word-level timestamps** (available from Whisper ASR or Gemini with word-level timing).

#### Approach A: Karaoke Tags (`\k`) — Simplest

Uses the built-in karaoke system. `SecondaryColour` = unhighlighted, `PrimaryColour` = highlighted.

```
[V4+ Styles]
; Primary=Yellow (highlight), Secondary=White (base text)
Style: Karaoke,Roboto-Bold,77,&H0000FFFF&,&H00FFFFFF&,&H00000000&,&H80000000&,-1,0,0,0,100,100,0,0,4,0,0,2,54,54,384,1

[Events]
; \k durations are in centiseconds (1cs = 10ms)
Dialogue: 0,0:00:01.00,0:00:03.00,Karaoke,,0,0,0,,{\k50}Hello {\k100}beautiful {\k75}world
```

```typescript
// Generate karaoke line from word-level timestamps
function generateKaraokeLine(words: WordTiming[]): string {
  return words.map((word, i) => {
    const durationCs = Math.round((word.endTime - word.startTime) * 100);
    return `{\\k${durationCs}}${word.text}`;
  }).join(' ');
}
```

**Pros:** Single dialogue line, simple. **Cons:** Limited to 2-color highlight (Primary/Secondary), no custom highlight effects.

#### Approach B: Inline Color Override (`\c`) — Most Flexible

Creates separate Dialogue events for each word's active period, using inline `\c` tags to color the active word differently.

```
[Events]
; Word "Hello" highlighted (0.00-0.50s)
Dialogue: 0,0:00:00.00,0:00:00.50,TextLayer,,0,0,0,,{\c&H00FFFF&}Hello {\c&HFFFFFF&}beautiful world
; Word "beautiful" highlighted (0.50-1.20s)
Dialogue: 0,0:00:00.50,0:00:01.20,TextLayer,,0,0,0,,{\c&HFFFFFF&}Hello {\c&H00FFFF&}beautiful {\c&HFFFFFF&}world
; Word "world" highlighted (1.20-1.80s)
Dialogue: 0,0:00:01.20,0:00:01.80,TextLayer,,0,0,0,,{\c&HFFFFFF&}Hello beautiful {\c&H00FFFF&}world
```

```typescript
interface WordTiming {
  text: string;
  startTime: number;
  endTime: number;
}

/**
 * Generate ASS dialogue lines with word-by-word color highlighting.
 * Creates one Dialogue event per word-highlight window.
 *
 * @param words - Array of words with precise timestamps
 * @param highlightColor - ASS color for the active word (e.g., '&H0000FFFF&' for yellow)
 * @param baseColor - ASS color for inactive words (e.g., '&H00FFFFFF&' for white)
 * @param styleName - ASS style name to apply
 */
function generateWordHighlightLines(
  words: WordTiming[],
  highlightColor: string,
  baseColor: string,
  styleName: string,
): string[] {
  const lines: string[] = [];
  const fullText = words.map(w => w.text).join(' ');

  for (let i = 0; i < words.length; i++) {
    const start = formatAssTime(words[i].startTime);
    const end = formatAssTime(words[i].endTime);

    // Build text with inline color overrides
    let text = '';
    for (let j = 0; j < words.length; j++) {
      const color = j === i ? highlightColor : baseColor;
      text += (j > 0 ? ' ' : '') + `{\\c${color}}${words[j].text}`;
    }

    lines.push(`Dialogue: 1,${start},${end},${styleName},,0,0,0,,${text}`);
  }

  return lines;
}
```

**Pros:** Any color, multiple highlight colors, combinable with other effects.
**Cons:** Generates N dialogue lines per sentence (one per word).

#### Approach C: Multi-Layer Alpha Masking — Most Effect-Rich

Uses two layers: an inactive base layer and an active highlight layer with alpha masking.

```
[V4+ Styles]
Style: Inactive,Roboto-Bold,77,&H80FFFFFF&,&H000000FF&,&H00000000&,&H80000000&,-1,0,0,0,100,100,0,0,4,0,0,2,54,54,384,1
Style: Active,Roboto-Bold,77,&H00FFFF00&,&H000000FF&,&H00000000&,&H00000000&,-1,0,0,0,100,100,0,0,1,4,0,2,54,54,384,1

[Events]
; Base layer: entire sentence, dimmed
Dialogue: 0,0:00:00.00,0:00:01.80,Inactive,,0,0,0,,Hello beautiful world
; Highlight "Hello" — other words made fully transparent
Dialogue: 1,0:00:00.00,0:00:00.50,Active,,0,0,0,,Hello{\alpha&HFF&} beautiful world
; Highlight "beautiful"
Dialogue: 1,0:00:00.50,0:00:01.20,Active,,0,0,0,,{\alpha&HFF&}Hello {\alpha&H00&}beautiful{\alpha&HFF&} world
; Highlight "world"
Dialogue: 1,0:00:01.20,0:00:01.80,Active,,0,0,0,,{\alpha&HFF&}Hello beautiful {\alpha&H00&}world
```

**Pros:** Full style separation (outline, shadow, glow on active word only), most visually striking.
**Cons:** Most complex generation logic, 1 + N dialogue lines per sentence.

---

### Subtitle Animation Patterns

#### Fade In/Out (Recommended Default)
```
; Every subtitle fades in over 150ms and out over 200ms
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\fad(150,200)}Hello world
```

#### Pop-In (Scale from 0 to 100%)
```
; Text grows from nothing to full size in 200ms
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\fscx0\fscy0\t(0,200,\fscx100\fscy100)}Hello world
```

#### Slide-In from Bottom
```
; Text slides upward into position over 250ms
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\move(540,1920,540,1536,0,250)}Hello world
```

#### Bounce/Spring Effect (using accel in `\t`)
```
; Overshoot then settle: scale to 120% fast then back to 100%
Dialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,{\fscx0\fscy0\t(0,150,0.5,\fscx120\fscy120)\t(150,300,2,\fscx100\fscy100)}Hello
```

#### Combining Animations with `\t`
The `\t` tag can animate most style properties. The `accel` parameter controls easing:
- `accel = 1`: linear
- `accel < 1`: ease-out (fast start, slow end)
- `accel > 1`: ease-in (slow start, fast end)

```typescript
// Generate fade-in for each subtitle
function addFadeToDialogue(text: string, fadeInMs = 150, fadeOutMs = 200): string {
  return `{\\fad(${fadeInMs},${fadeOutMs})}${text}`;
}
```

---

### FFmpeg Subtitle Filter Configuration

#### Burning ASS subtitles into video
```bash
# Using the 'subtitles' filter (handles format conversion, supports SRT too)
ffmpeg -i input.mp4 \
  -vf "subtitles=filename='subs.ass':fontsdir='/path/to/fonts'" \
  -c:a copy output.mp4

# Using the 'ass' filter (ASS files only, lighter — no libavformat needed)
ffmpeg -i input.mp4 \
  -vf "ass='subs.ass':fontsdir='/path/to/fonts'" \
  -c:a copy output.mp4
```

#### Within a complex filtergraph (as used in this project)
```typescript
// Inside renderVerticalVideo filtergraph:
const filterPath = assPath.replace(/'/g, "'\\\\''");
const fontsDir = fontsDirPath.replace(/'/g, "'\\\\''");
filterComplex += `[v_concat]subtitles=filename='${filterPath}':fontsdir='${fontsDir}'[v_final];`;
```

#### Force style override (SRT → styled output)
```bash
# Override default style when burning SRT subtitles
ffmpeg -i input.mp4 \
  -vf "subtitles='subs.srt':force_style='FontName=Impact,FontSize=24,PrimaryColour=&H00FFFFFF&,BorderStyle=4,BackColour=&H80000000&'" \
  -c:a copy output.mp4
```

#### Available `force_style` parameters
All `[V4+ Styles]` format fields can be overridden: `FontName`, `FontSize`, `PrimaryColour`, `SecondaryColour`, `OutlineColour`, `BackColour`, `Bold`, `Italic`, `BorderStyle`, `Outline`, `Shadow`, `Alignment`, `MarginL`, `MarginR`, `MarginV`.

---

### Word-Level Timestamp Prerequisites

For word-by-word highlight, you need timestamps per word. Current pipeline options:

| Source | Format | Word-Level Support |
|--------|--------|--------------------|
| Whisper ASR | SRT/JSON | ✅ JSON output with `--word_timestamps` flag gives per-word timing |
| Gemini API | Structured JSON | ⚠️ Possible with specific prompting (request `words[]` with timing) |
| Manual | Editor | ❌ Current editor stores per-segment, not per-word |

**Integration pattern:** Extend `SubtitleResponse` to include optional word-level data:
```typescript
interface WordTiming {
  text: string;
  startTime: number;  // seconds
  endTime: number;    // seconds
}

interface SubtitleResponse {
  id: string;
  shortId: string;
  startTime: number;
  endTime: number;
  text: string;
  words?: WordTiming[];  // Optional word-level timing for highlight effects
}
```

---

### Performance Considerations for Advanced Subtitles

| Feature | Performance Impact | Notes |
|---------|-------------------|-------|
| Basic subtitles | ✅ Negligible | Single layer, no effects |
| Dual-layer (bg + text) | ✅ Minimal | 2× dialogue lines, but libass handles efficiently |
| Fade in/out (`\fad`) | ✅ Minimal | Simple alpha interpolation |
| Word highlight (inline `\c`) | ⚠️ Moderate | N dialogue lines per sentence; keep sentences ≤10 words |
| `\blur` / `\be` | ⚠️ Moderate | Gaussian blur is GPU-intensive if libass uses software rendering |
| `\t` animations | ⚠️ Moderate | Each animated property recalculates per-frame |
| `\clip` with vector | 🔴 High | Complex vector clipping on every frame is expensive |
| Karaoke (`\k`) | ✅ Minimal | Optimized in libass for this use case |

**Rule of thumb:** For YouTube Shorts (≤60s), all features above are acceptable. For batch processing, avoid `\blur` + `\t` combinations on every line.

---

### libass vs VSFilter Rendering Differences

`libass` (used by FFmpeg) aims for VSFilter compatibility but has known differences:

| Feature | libass | VSFilter |
|---------|--------|----------|
| `BorderStyle 4` | ✅ Supported | ⚠️ Partial |
| `\blur` | ✅ Gaussian | Box blur |
| `\be` | ✅ Supported | Different algorithm |
| `\clip` with drawings | ✅ Supported | ✅ Supported |
| `\t` animation | ✅ Supported | ✅ Supported |
| `\p` vector drawing | ✅ Supported | ✅ Supported |
| Complex `\fad` | ✅ Supported | ✅ Supported |
| Collision detection | Different behavior | Standard |
| Line wrapping | Slightly different | Standard |

**Rule:** Always test final output with FFmpeg's actual `libass` rendering — do not rely solely on Aegisub or MPC-HC previews (which use VSFilter).


## FFmpeg Cheat Sheet

| Task | Command Pattern |
|------|-----------------|
| Extract metadata | `ffprobe -v quiet -print_format json -show_format -show_streams input.mp4` |
| Cut segment | `ffmpeg -ss START -i input.mp4 -t DURATION -c copy output.mp4` |
| Vertical resize | `ffmpeg -i input.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2" output.mp4` |
| Extract audio | `ffmpeg -i input.mp4 -vn -acodec pcm_s16le output.wav` |
| Concat videos | `ffmpeg -f concat -safe 0 -i list.txt -c copy output.mp4` |
| Burn ASS subtitles | `ffmpeg -i input.mp4 -vf "subtitles=filename='subs.ass':fontsdir='/fonts'" output.mp4` |
| Burn SRT w/ style | `ffmpeg -i input.mp4 -vf "subtitles='subs.srt':force_style='FontSize=24,BorderStyle=4'" output.mp4` |
| Extract frame | `ffmpeg -ss 5 -i input.mp4 -vframes 1 -q:v 2 thumb.jpg` |

## Checklist for FFmpeg Operations

- [ ] Use `spawn`, never `execSync`
- [ ] Parse stderr for progress/errors
- [ ] Implement progress callbacks for jobs > 5s
- [ ] Cleanup temp files in try/finally blocks
- [ ] Check exit code (0 = success)
- [ ] Test with various video formats/codecs
- [ ] Handle missing FFmpeg binary gracefully
- [ ] Log errors with context (file paths, args)

## Checklist for ASS Subtitle Operations

- [ ] Scale all pixel values from UI to export resolution
- [ ] Convert CSS colors to `&HAABBGGRR&` format (inverted alpha, BGR order)
- [ ] Map font-family names to physical TTF filenames
- [ ] Configure `fontsdir` path in FFmpeg filter
- [ ] Use dual-layer pattern (BgLayer + TextLayer) for background + shadow
- [ ] Use `BorderStyle=4` (not 3) for uniform background boxes
- [ ] Do NOT use custom `line-height` — rely on font native metrics
- [ ] Test final render with FFmpeg (not just Aegisub preview)

## Resources

- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html)
- [FFmpeg subtitles filter](https://ffmpeg.org/ffmpeg-filters.html#subtitles-1)
- [libass GitHub](https://github.com/libass/libass) — FFmpeg's ASS rendering engine
- [ASS Override Tags Reference](https://aegi.vmoe.info/docs/3.0/ASS_Tags/) — Aegisub docs
- [ASS Format Spec (v4+)](https://wiki.multimedia.cx/index.php?title=SubStation_Alpha) — Full format specification
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Zero-Persistence)

