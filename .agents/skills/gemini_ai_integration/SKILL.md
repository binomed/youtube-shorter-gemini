---
name: Gemini AI Integration
description: Multimodal prompting and video analysis using Gemini API for intelligent clip detection and timing
---

# Gemini IA Custom Skill

## When to Use This Skill

Use this skill when working on AI-powered features in `apps/back/src/modules/analysis/`. This includes:
- Detecting interesting moments in videos
- Generating segment timestamps via multimodal analysis
- Crafting effective prompts for video understanding
- Managing Gemini API quotas and costs
- Implementing fallback to local Ollama models

## Core Principles

### 1. Multimodal Analysis Strategy
- Send **video frames + audio transcripts** for best results
- Use **strategic frame sampling** (every 1-2 seconds, not every frame)
- Include **temporal context** in prompts (timestamp, duration)
- Request **structured JSON responses** for reliable parsing

### 2. Hybrid Cloud/Local Architecture
- **Primary**: Gemini API (gemini-2.0-flash-exp or gemini-1.5-pro)
- **Fallback**: Local Ollama (llama3.2-vision) for privacy-sensitive content
- **Cost optimization**: Cache video analysis, reuse results

### 3. Prompt Engineering Best Practices
- Be **specific** about desired output format
- Use **few-shot examples** for consistent JSON structure
- Leverage **system instructions** for role definition
- Request **confidence scores** for quality filtering

## Mandatory Patterns & Rules

### Gemini Service Structure

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import * as fs from 'fs/promises';

/**
 * Service for interacting with Gemini AI for video analysis.
 * Handles multimodal prompting, frame sampling, and response parsing.
 */
@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: GenerativeModel;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    
    if (!apiKey) {
      this.logger.warn('GEMINI_API_KEY not found, Gemini features disabled');
    }

    this.genAI = new GoogleGenerativeAI(apiKey || '');
    
    // Use latest efficient model
    this.model = this.genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.4, // Lower = more deterministic
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });
  }

  /**
   * Analyze video to detect interesting moments for Shorts.
   * Returns array of suggested segments with timestamps and reasons.
   * 
   * @param videoFrames - Array of base64-encoded frames
   * @param audioTranscript - Optional transcript for context
   * @param videoDuration - Total video duration in seconds
   * @returns Array of detected segments
   */
  async detectShortsCandidates(
    videoFrames: string[],
    audioTranscript?: string,
    videoDuration?: number,
  ): Promise<ShortsSegment[]> {
    const prompt = this.buildDetectionPrompt(audioTranscript, videoDuration);

    try {
      const parts = [
        { text: prompt },
        ...videoFrames.map((frame, idx) => ({
          inlineData: {
            mimeType: 'image/jpeg',
            data: frame,
          },
          // Include frame timing context
          text: `Frame ${idx + 1} (approx ${Math.round((idx / videoFrames.length) * (videoDuration || 100))}s)`,
        })),
      ];

      const result = await this.model.generateContent(parts);
      const response = result.response.text();

      // Parse JSON response
      const segments = this.parseSegmentsResponse(response);
      
      this.logger.log(`Detected ${segments.length} potential Shorts segments`);
      return segments;

    } catch (error) {
      this.logger.error(`Gemini API error: ${error.message}`);
      
      // Fallback to Ollama if configured
      if (this.configService.get('OLLAMA_ENABLED')) {
        return this.fallbackToOllama(videoFrames, audioTranscript);
      }
      
      throw error;
    }
  }

  /**
   * Build the detection prompt with clear instructions and output format.
   */
  private buildDetectionPrompt(transcript?: string, duration?: number): string {
    return `You are an expert video editor for YouTube Shorts. Analyze this video and identify the most engaging 30-60 second segments that would make great vertical Shorts.

**Context:**
- Total video duration: ${duration || 'unknown'} seconds
- Audio transcript: ${transcript || 'not provided'}

**Your task:**
1. Identify 3-5 distinct moments with high engagement potential (hooks, punchlines, visual highlights, emotional peaks)
2. For each moment, provide:
   - Start timestamp (seconds)
   - End timestamp (seconds, max 60s duration)
   - Confidence score (0-100)
   - Reason (one sentence explaining why this would make a great Short)

**Output format (JSON only, no markdown):**
\`\`\`json
[
  {
    "startTime": 45.5,
    "endTime": 78.2,
    "confidence": 85,
    "reason": "Strong visual hook with surprising reveal"
  }
]
\`\`\`

Only return the JSON array. No additional text.`;
  }

  /**
   * Parse Gemini's text response into structured segments.
   * Handles markdown code blocks and malformed JSON gracefully.
   */
  private parseSegmentsResponse(response: string): ShortsSegment[] {
    try {
      // Remove markdown code blocks if present
      let jsonText = response.trim();
      jsonText = jsonText.replace(/```json\n?/g, '');
      jsonText = jsonText.replace(/```\n?/g, '');
      
      const parsed = JSON.parse(jsonText);
      
      // Validate structure
      if (!Array.isArray(parsed)) {
        throw new Error('Response is not an array');
      }

      return parsed
        .filter((seg) => 
          typeof seg.startTime === 'number' &&
          typeof seg.endTime === 'number' &&
          seg.endTime > seg.startTime
        )
        .map((seg) => ({
          startTime: seg.startTime,
          endTime: seg.endTime,
          confidence: seg.confidence || 50,
          reason: seg.reason || 'Interesting moment detected',
        }));

    } catch (error) {
      this.logger.error(`Failed to parse Gemini response: ${error.message}`);
      this.logger.debug(`Raw response: ${response}`);
      return []; // Return empty array on parse failure
    }
  }

  /**
   * Refine segment timing using detailed frame analysis.
   * Used for "Timing IA" feature (FR-05).
   * 
   * @param frames - Array of frames around the segment
   * @param roughStart - Initial start time estimate
   * @param roughEnd - Initial end time estimate
   * @returns Precise start/end timestamps
   */
  async refineSegmentTiming(
    frames: string[],
    roughStart: number,
    roughEnd: number,
  ): Promise<{ preciseStart: number; preciseEnd: number }> {
    const prompt = `Analyze these frames from a video segment (approximately ${roughStart}s to ${roughEnd}s).

Your task: Identify the EXACT best start and end points for maximum impact.

**Criteria:**
- Start: First moment of visual/audio hook (avoid dead air or slow buildup)
- End: Natural conclusion or peak moment (avoid awkward cutoffs)

**Output (JSON only):**
\`\`\`json
{
  "preciseStart": 45.2,
  "preciseEnd": 78.8,
  "reasoning": "Start adjusted to capture full sentence, end at laugh peak"
}
\`\`\``;

    try {
      const parts = [
        { text: prompt },
        ...frames.map((frame) => ({
          inlineData: { mimeType: 'image/jpeg', data: frame },
        })),
      ];

      const result = await this.model.generateContent(parts);
      const response = result.response.text();
      
      const parsed = JSON.parse(
        response.replace(/```json\n?/g, '').replace(/```/g, '')
      );

      return {
        preciseStart: parsed.preciseStart || roughStart,
        preciseEnd: parsed.preciseEnd || roughEnd,
      };

    } catch (error) {
      this.logger.warn(`Timing refinement failed, using rough estimates: ${error.message}`);
      return { preciseStart: roughStart, preciseEnd: roughEnd };
    }
  }

  /**
   * Fallback to local Ollama model when Gemini is unavailable.
   */
  private async fallbackToOllama(
    frames: string[],
    transcript?: string,
  ): Promise<ShortsSegment[]> {
    this.logger.log('Falling back to Ollama for video analysis');
    
    const ollamaUrl = this.configService.get<string>('OLLAMA_URL', 'http://localhost:11434');
    
    try {
      // Call Ollama API (simplified - implement full integration as needed)
      const response = await fetch(`${ollamaUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3.2-vision',
          prompt: this.buildDetectionPrompt(transcript),
          images: frames,
        }),
      });

      const data = await response.json();
      return this.parseSegmentsResponse(data.response);

    } catch (error) {
      this.logger.error(`Ollama fallback failed: ${error.message}`);
      return []; // Return empty if both fail
    }
  }

  /**
   * Generate a text summary/title for a video segment.
   * Used for UI display and metadata.
   */
  async generateSegmentSummary(
    frames: string[],
    transcript?: string,
  ): Promise<string> {
    const prompt = `Analyze this video segment and generate a catchy, concise title (max 60 characters) for a YouTube Short.

Transcript: ${transcript || 'N/A'}

Output only the title, no quotes or extra text.`;

    try {
      const parts = [
        { text: prompt },
        ...frames.slice(0, 3).map((frame) => ({ // Use first 3 frames
          inlineData: { mimeType: 'image/jpeg', data: frame },
        })),
      ];

      const result = await this.model.generateContent(parts);
      return result.response.text().trim().slice(0, 60);

    } catch (error) {
      this.logger.error(`Summary generation failed: ${error.message}`);
      return 'Untitled Segment';
    }
  }
}

/**
 * Detected Shorts segment structure.
 */
export interface ShortsSegment {
  startTime: number; // seconds
  endTime: number; // seconds
  confidence: number; // 0-100
  reason: string; // explanation
}
```

### Frame Sampling Strategy

Extract frames using FFmpeg before sending to Gemini:

```typescript
/**
 * Extract frames at regular intervals for AI analysis.
 * Optimizes cost/performance by limiting frame count.
 */
async extractFramesForAnalysis(
  videoPath: string,
  maxFrames: number = 30,
): Promise<string[]> {
  const metadata = await this.ffmpegService.extractMetadata(videoPath);
  const interval = Math.max(1, Math.floor(metadata.duration / maxFrames));

  const frames: string[] = [];

  for (let i = 0; i < maxFrames; i++) {
    const timestamp = i * interval;
    const framePath = await this.extractSingleFrame(videoPath, timestamp);
    
    // Convert to base64
    const frameBuffer = await fs.readFile(framePath);
    frames.push(frameBuffer.toString('base64'));
    
    // Cleanup
    await fs.unlink(framePath);
  }

  return frames;
}

private async extractSingleFrame(
  videoPath: string,
  timestamp: number,
): Promise<string> {
  const outputPath = `/tmp/frame-${Date.now()}-${timestamp}.jpg`;

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-ss', timestamp.toString(),
      '-i', videoPath,
      '-vframes', '1', // Single frame
      '-q:v', '2', // High quality
      '-y',
      outputPath,
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve(outputPath);
      else reject(new Error(`Frame extraction failed at ${timestamp}s`));
    });
  });
}
```

## Common Pitfalls

### ❌ DON'T: Send raw video files to API
```typescript
// BAD: Sending 500MB .mp4 file directly to Gemini API
// - Extremely expensive (video = millions of tokens)
// - Very slow (upload + processing time)
// - May exceed API size limits
const result = await gemini.analyzeVideo(fullVideoBuffer);
```

### ✅ DO: Analyze ENTIRE video via smart frame sampling
```typescript
// GOOD: Analyze the complete video duration, but efficiently
// - Extract 20-30 frames distributed across ENTIRE video
// - Each frame represents a moment in the full timeline
// - Gemini sees the whole video narrative via these samples
const frames = await extractFramesForAnalysis(videoPath, 25);
// frames[0] = start, frames[12] = middle, frames[24] = end
const segments = await gemini.detectShortsCandidates(frames, transcript);
```

**Note importante:** Le logiciel YouTube-Shorter-Gemini **DOIT analyser toute la vidéo** pour détecter les meilleurs segments. L'échantillonnage de frames est la technique pour le faire efficacement sans envoyer le fichier binaire complet.

### ❌ DON'T: Trust JSON parsing blindly
```typescript
// BAD: Will crash on malformed response
const segments = JSON.parse(response);
```

### ✅ DO: Validate and handle parse errors
```typescript
// GOOD: Graceful degradation
try {
  const segments = this.parseSegmentsResponse(response);
  return segments.filter(s => s.confidence > 60);
} catch (error) {
  return [];
}
```

### ❌ DON'T: Hardcode model names
```typescript
// BAD: Will break when models are deprecated
const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
```

### ✅ DO: Use config and latest models
```typescript
// GOOD: Configurable and up-to-date
const modelName = this.configService.get('GEMINI_MODEL', 'gemini-2.0-flash-exp');
const model = this.genAI.getGenerativeModel({ model: modelName });
```

## Prompt Engineering Patterns

### Few-Shot Prompting

When you need consistent output format:

```typescript
const fewShotPrompt = `Detect highlights in this video.

Example 1:
Input: Cooking tutorial with reveal at 2:30
Output: [{"startTime": 145, "endTime": 165, "confidence": 90, "reason": "Dramatic food reveal"}]

Example 2:
Input: Gaming stream with clutch play at 5:10
Output: [{"startTime": 305, "endTime": 330, "confidence": 95, "reason": "Intense clutch moment with reaction"}]

Now analyze this video:
[your actual content]`;
```

### Chain-of-Thought for Complex Analysis

```typescript
const cotPrompt = `Analyze this video step-by-step:

Step 1: Identify all moments with high visual activity or emotional intensity
Step 2: Check if audio (speech/music) aligns with visuals for impact
Step 3: Select top 3 segments between 30-60 seconds
Step 4: Output as JSON array

Think through each step, then provide final JSON.`;
```

## Cost Optimization

### Caching Strategy

```typescript
import { createHash } from 'crypto';

/**
 * Cache analysis results to avoid redundant API calls.
 */
async detectWithCache(
  videoPath: string,
  frames: string[],
): Promise<ShortsSegment[]> {
  // Generate cache key from video hash
  const videoHash = await this.hashFile(videoPath);
  const cacheKey = `gemini:analysis:${videoHash}`;

  // Check cache (Redis, SQLite, or memory)
  const cached = await this.cacheService.get(cacheKey);
  if (cached) {
    this.logger.log('Using cached analysis result');
    return JSON.parse(cached);
  }

  // Call Gemini
  const segments = await this.detectShortsCandidates(frames);

  // Cache for 7 days
  await this.cacheService.set(cacheKey, JSON.stringify(segments), 604800);

  return segments;
}
```

### Request Batching

```typescript
/**
 * Process multiple videos in batches to optimize quota usage.
 */
async batchAnalyze(videoPaths: string[]): Promise<Map<string, ShortsSegment[]>> {
  const results = new Map();
  const BATCH_SIZE = 5;

  for (let i = 0; i < videoPaths.length; i += BATCH_SIZE) {
    const batch = videoPaths.slice(i, i + BATCH_SIZE);
    
    const batchResults = await Promise.all(
      batch.map(async (path) => {
        const frames = await this.extractFramesForAnalysis(path, 20);
        const segments = await this.detectShortsCandidates(frames);
        return [path, segments];
      })
    );

    batchResults.forEach(([path, segments]) => results.set(path, segments));
    
    // Rate limiting: wait between batches
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return results;
}
```

## Testing Requirements

### Unit Tests with Mocked Responses

```typescript
describe('GeminiService', () => {
  it('should parse valid JSON response', () => {
    const mockResponse = `\`\`\`json
    [{"startTime": 10, "endTime": 40, "confidence": 85, "reason": "Test"}]
    \`\`\``;

    const segments = service['parseSegmentsResponse'](mockResponse);

    expect(segments).toHaveLength(1);
    expect(segments[0].startTime).toBe(10);
  });

  it('should handle malformed JSON gracefully', () => {
    const malformed = 'This is not JSON';
    const segments = service['parseSegmentsResponse'](malformed);
    
    expect(segments).toEqual([]);
  });

  it('should filter segments with invalid timestamps', () => {
    const response = `[
      {"startTime": 10, "endTime": 40, "confidence": 80, "reason": "Valid"},
      {"startTime": 50, "endTime": 30, "confidence": 90, "reason": "Invalid: end < start"}
    ]`;

    const segments = service['parseSegmentsResponse'](response);
    
    expect(segments).toHaveLength(1);
    expect(segments[0].startTime).toBe(10);
  });
});
```

### Integration Tests (with API key)

```typescript
describe('GeminiService Integration', () => {
  it('should detect segments in sample video', async () => {
    const frames = await extractFramesForAnalysis('sample.mp4', 15);
    const segments = await geminiService.detectShortsCandidates(frames);

    expect(segments.length).toBeGreaterThan(0);
    expect(segments[0]).toHaveProperty('startTime');
    expect(segments[0]).toHaveProperty('confidence');
  }, 30000); // 30s timeout for API call
});
```

## Configuration

Add to `.env`:

```bash
# Gemini Configuration
GEMINI_API_KEY=AIzaSy...your-key-here
GEMINI_MODEL=gemini-2.0-flash-exp

# Ollama Fallback (optional)
OLLAMA_ENABLED=false
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2-vision
```

## Checklist for AI Integration

- [ ] API key loaded from ConfigService (never hardcoded)
- [ ] Frame sampling limited to 20-30 frames max
- [ ] JSON parsing includes error handling
- [ ] Confidence threshold applied (e.g., >60)
- [ ] Responses cached to avoid redundant calls
- [ ] Fallback to Ollama implemented for critical features
- [ ] Rate limiting respects API quotas
- [ ] Costs monitored and logged
- [ ] Prompts request structured JSON format
- [ ] Tests cover both success and failure paths

## Resources

- [Gemini API Documentation](https://ai.google.dev/docs)
- [Multimodal Prompting Guide](https://ai.google.dev/gemini-api/docs/vision)
- [Ollama Documentation](https://ollama.ai/docs)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Hybrid IA Strategy)
