import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { WordTiming } from '@youtube-shorter/shared';

export interface WhisperWord {
  word: string;
  start?: number;
  end?: number;
}

export interface WhisperSegment {
  start: number;
  end: number;
  text: string;
  words?: WhisperWord[];
}

export interface WhisperOutput {
  segments: WhisperSegment[];
  language: string;
}

export interface WhisperChunk {
  startTime: number;
  endTime: number;
  text: string;
  words: WordTiming[];
}

@Injectable()
export class WhisperService {
  private readonly logger = new Logger(WhisperService.name);

  /**
   * Run WhisperX CLI for transcription and word-level timestamps.
   * Groups words into chunks and returns structured data with word-level timings.
   */
  async generateSubtitlesWithWords(
    inputAudioPath: string,
    maxWordsPerBlock: number = 7,
  ): Promise<WhisperChunk[]> {
    const outputDir = path.dirname(inputAudioPath);
    const basename = path.basename(
      inputAudioPath,
      path.extname(inputAudioPath),
    );
    const jsonOutputPath = path.join(outputDir, `${basename}.json`);

    this.logger.log(
      `Running WhisperX on ${inputAudioPath} (output: ${outputDir})`,
    );

    // Command: whisperx <audioPath> --model medium --output_format json --word_timestamps True --output_dir <outputDir>
    await new Promise<void>((resolve, reject) => {
      // Note: First run will download the model, which can be slow and output a lot to stderr.
      // Using 'base' model to drastically improve speed (up to 10x faster than medium) while
      // keeping phoneme alignment accurate. Added batch_size for parallel inference.
      const proc = spawn('whisperx', [
        inputAudioPath,
        '--model',
        'base',
        '--output_format',
        'json',
        '--compute_type',
        'int8', // int8 is optimized for CPU/Mac fallback speed
        '--batch_size',
        '16', // Process multiple audio chunks in parallel
        '--output_dir',
        outputDir,
      ]);

      let stderrLogs = '';

      proc.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        stderrLogs += text;
        // Whisper logs its progress on stderr primarily
        this.logger.debug(`[whisperx] ${text.trim()}`);
      });

      proc.on('close', (code) => {
        if (code === 0) resolve();
        else {
          this.logger.error(
            `whisperx failed with code ${code}. Logs: ${stderrLogs}`,
          );
          reject(new Error(`WhisperX failed (code ${code}).`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Could not spawn whisperx: ${err.message}`));
      });
    });

    // Read the output JSON
    let fileContent: string;
    try {
      fileContent = await fs.readFile(jsonOutputPath, 'utf-8');
    } catch {
      throw new Error(
        `WhisperX finished but output file ${jsonOutputPath} not found.`,
      );
    }

    // Cleanup output files
    try {
      await fs.unlink(jsonOutputPath).catch(() => {});
      // WhisperX also generates other files potentially if --output_format is not specified properly, but here we strictly set json
    } catch {
      // Ignore cleanup errors
    }

    const parsedData = JSON.parse(fileContent) as WhisperOutput;

    return this.buildChunksFromWords(parsedData, maxWordsPerBlock);
  }

  /**
   * Legacy method for raw SRT output.
   */
  async generateSubtitles(
    inputAudioPath: string,
    maxWordsPerBlock = 7,
  ): Promise<string> {
    const chunks = await this.generateSubtitlesWithWords(
      inputAudioPath,
      maxWordsPerBlock,
    );
    return this.convertChunksToSrt(chunks);
  }

  /**
   * Groups words from Whisper segments into max N words chunks.
   */
  private buildChunksFromWords(
    data: WhisperOutput,
    maxWords: number,
  ): WhisperChunk[] {
    const chunks: WhisperChunk[] = [];

    for (const segment of data.segments) {
      if (!segment.words || segment.words.length === 0) {
        // Fallback to phrase-level if WhisperX couldn't align words
        chunks.push({
          startTime: segment.start,
          endTime: segment.end,
          text: segment.text.trim(),
          words: this.distributeWordsUniformly(
            segment.text.trim(),
            segment.start,
            segment.end,
          ),
        });
        continue;
      }

      const words = segment.words;
      let currentWords: WhisperWord[] = [];

      for (let i = 0; i < words.length; i++) {
        currentWords.push(words[i]);

        if (currentWords.length >= maxWords || i === words.length - 1) {
          const start =
            currentWords.find((w) => w.start !== undefined)?.start ??
            segment.start;
          const end =
            [...currentWords].reverse().find((w) => w.end !== undefined)?.end ??
            segment.end;

          const textChunk = currentWords
            .map((w) => w.word)
            .join(' ')
            .trim();

          if (textChunk) {
            chunks.push({
              startTime: start,
              endTime: end,
              text: textChunk,
              words: currentWords.map((w) => ({
                text: w.word,
                startTime: w.start ?? start,
                endTime: w.end ?? end,
              })),
            });
          }

          currentWords = [];
        }
      }
    }

    return chunks;
  }

  private distributeWordsUniformly(
    text: string,
    startTime: number,
    endTime: number,
  ): WordTiming[] {
    const tokens = text
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    if (tokens.length === 0) return [];

    const duration = Math.max(0, endTime - startTime);
    const wordDuration = duration / tokens.length;

    return tokens.map((t, i) => ({
      text: t,
      startTime: startTime + i * wordDuration,
      endTime: startTime + (i + 1) * wordDuration,
    }));
  }

  private convertChunksToSrt(chunks: WhisperChunk[]): string {
    return chunks
      .map((chunk, i) => {
        return `${i + 1}\n${this.formatSrtTime(chunk.startTime)} --> ${this.formatSrtTime(chunk.endTime)}\n${chunk.text}\n`;
      })
      .join('\n');
  }

  private formatSrtTime(seconds: number): string {
    const date = new Date(seconds * 1000);
    const hh = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    const ss = String(date.getUTCSeconds()).padStart(2, '0');
    const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
  }
}
