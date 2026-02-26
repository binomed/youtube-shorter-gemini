import { Injectable, Logger } from '@nestjs/common';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

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

@Injectable()
export class WhisperService {
    private readonly logger = new Logger(WhisperService.name);

    /**
     * Run WhisperX CLI for transcription and word-level timestamps.
     * Groups words into chunks of a given max length (e.g. 7) to generate a punchy SRT.
     */
    async generateSubtitles(inputAudioPath: string, maxWordsPerBlock: number = 7): Promise<string> {
        const outputDir = path.dirname(inputAudioPath);
        const basename = path.basename(inputAudioPath, path.extname(inputAudioPath));
        const jsonOutputPath = path.join(outputDir, `${basename}.json`);

        this.logger.log(`Running WhisperX on ${inputAudioPath} (output: ${outputDir})`);

        // Command: whisperx <audioPath> --model medium --output_format json --word_timestamps True --output_dir <outputDir>
        await new Promise<void>((resolve, reject) => {
            // Note: First run will download the model, which can be slow and output a lot to stderr.
            // Using 'base' model to drastically improve speed (up to 10x faster than medium) while
            // keeping phoneme alignment accurate. Added batch_size for parallel inference.
            const proc = spawn('whisperx', [
                inputAudioPath,
                '--model', 'base',
                '--output_format', 'json',
                '--compute_type', 'int8', // int8 is optimized for CPU/Mac fallback speed
                '--batch_size', '16', // Process multiple audio chunks in parallel
                '--output_dir', outputDir
            ]);

            let stderrLogs = '';

            proc.stderr.on('data', (data) => {
                const text = data.toString();
                stderrLogs += text;
                // Whisper logs its progress on stderr primarily
                this.logger.debug(`[whisperx] ${text.trim()}`);
            });

            proc.on('close', (code) => {
                if (code === 0) resolve();
                else {
                    this.logger.error(`whisperx failed with code ${code}. Logs: ${stderrLogs}`);
                    reject(new Error(`WhisperX failed (code ${code}). Is it installed locally?`));
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
        } catch (e) {
            throw new Error(`WhisperX finished but output file ${jsonOutputPath} not found.`);
        }

        // Cleanup output files
        try {
            await fs.unlink(jsonOutputPath).catch(() => { });
            // WhisperX also generates other files potentially if --output_format is not specified properly, but here we strictly set json
        } catch (e) { }

        const parsedData: WhisperOutput = JSON.parse(fileContent);

        // Reconstruct into a SRT with chunks of maxWordsPerBlock
        return this.buildSrtFromWords(parsedData, maxWordsPerBlock);
    }

    /**
     * Constructs an SRT string by grouping words from Whisper segments into max N words chunks.
     */
    private buildSrtFromWords(data: WhisperOutput, maxWords: number): string {
        let srtData = '';
        let counter = 1;

        for (const segment of data.segments) {
            if (!segment.words || segment.words.length === 0) {
                // Fallback to phrase-level if WhisperX couldn't align words
                srtData += `${counter}\n`;
                srtData += `${this.formatSrtTime(segment.start)} --> ${this.formatSrtTime(segment.end)}\n`;
                srtData += `${segment.text.trim()}\n\n`;
                counter++;
                continue;
            }

            const words = segment.words;
            let currentChunk: WhisperWord[] = [];

            for (let i = 0; i < words.length; i++) {
                currentChunk.push(words[i]);

                if (currentChunk.length >= maxWords || i === words.length - 1) {
                    // Identify chunk times. Some words might be lacking start/end due to silence trimming.
                    // In that case, we fall back to the first available bound in the chunk.
                    const start = currentChunk.find(w => w.start !== undefined)?.start ?? segment.start;
                    // For 'end', we search backwards to find the last valid end 
                    const end = [...currentChunk].reverse().find(w => w.end !== undefined)?.end ?? segment.end;

                    const textChunk = currentChunk.map(w => w.word).join(' ').trim();

                    if (textChunk) {
                        srtData += `${counter}\n`;
                        srtData += `${this.formatSrtTime(start)} --> ${this.formatSrtTime(end)}\n`;
                        srtData += `${textChunk}\n\n`;
                        counter++;
                    }

                    currentChunk = [];
                }
            }
        }

        return srtData.trim();
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
