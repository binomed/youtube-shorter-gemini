// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

export interface ParsedSubtitle {
    startTime: number;
    endTime: number;
    text: string;
}

/**
 * Parses an SRT timed string into an array of Subtitle objects with start/end times.
 */
export function parseSrt(srtContent: string): ParsedSubtitle[] {
    if (!srtContent || srtContent.trim() === '') {
        return [];
    }

    // Normalize line endings
    const content = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = content.split(/\n\n+/);
    const subtitles: ParsedSubtitle[] = [];

    for (const block of blocks) {
        if (!block.trim()) continue;

        const lines = block.trim().split('\n');
        const timecodeLineIndex = lines.findIndex(l => l.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/));

        if (timecodeLineIndex !== -1) {
            const timecodeLine = lines[timecodeLineIndex];
            const match = timecodeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);

            if (match) {
                const startTime = parseTimecode(match[1]);
                const endTime = parseTimecode(match[2]);
                const text = lines.slice(timecodeLineIndex + 1).join('\n').trim();

                if (text) {
                    const chunks = chunkSubtitle({ startTime, endTime, text });
                    subtitles.push(...chunks);
                }
            }
        }
    }

    return subtitles;
}

/**
 * Splits a subtitle into smaller chunks if it exceeds the word limit.
 * Interpolates the timecodes based on character length.
 */
function chunkSubtitle(sub: ParsedSubtitle, maxWords: number = 8): ParsedSubtitle[] {
    const words = sub.text.split(/\s+/);
    if (words.length <= maxWords) {
        return [sub];
    }

    const chunks: ParsedSubtitle[] = [];
    const totalChars = sub.text.length;
    const totalDuration = sub.endTime - sub.startTime;

    let currentWords: string[] = [];
    let currentStartTime = sub.startTime;

    for (let i = 0; i < words.length; i++) {
        currentWords.push(words[i]);

        // If we reach the max limit OR it's the last word
        if (currentWords.length >= maxWords || i === words.length - 1) {
            const chunkText = currentWords.join(' ');

            // Calculate proportional duration based on chunk length vs total string length
            const chunkDuration = (chunkText.length / totalChars) * totalDuration;
            const currentEndTime = Math.min(sub.endTime, currentStartTime + chunkDuration);

            chunks.push({
                startTime: parseFloat(currentStartTime.toFixed(3)),
                endTime: parseFloat(currentEndTime.toFixed(3)),
                text: chunkText
            });

            currentStartTime = currentEndTime;
            currentWords = [];
        }
    }

    // Ensure the last chunk exactly matches the original end time to prevent micro-gaps
    if (chunks.length > 0) {
        chunks[chunks.length - 1].endTime = sub.endTime;
    }

    return chunks;
}

/**
 * Converts SRT timecode to seconds (e.g. "00:01:23,450" -> 83.450)
 */
function parseTimecode(timecode: string): number {
    const parts = timecode.split(/[:,]/);
    if (parts.length !== 4) return 0;

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseInt(parts[2], 10);
    const milliseconds = parseInt(parts[3], 10);

    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
}
