// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { parseSrt } from './srt-parser.util';

describe('SrtParser', () => {
    it('should parse valid SRT content successfully', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:03,500
Hello world

2
00:00:04,200 --> 00:00:06,800
This is a test subtitle
Across two lines`;

        const result = parseSrt(srtContent);
        expect(result.length).toBe(2);
        expect(result[0].startTime).toBe(1.0);
        expect(result[0].endTime).toBe(3.5);
        expect(result[0].text).toBe('Hello world');

        expect(result[1].endTime).toBe(6.8);
        expect(result[1].text).toBe('This is a test subtitle\nAcross two lines');
    });

    it('should parse SRT content without index lines', () => {
        const srtContent = `00:00:01,000 --> 00:00:03,500
Hello world

00:00:04,200 --> 00:00:06,800
This is a test subtitle
Across two lines`;

        const result = parseSrt(srtContent);
        expect(result.length).toBe(2);
        expect(result[0].startTime).toBe(1.0);
        expect(result[0].endTime).toBe(3.5);
        expect(result[0].text).toBe('Hello world');

        expect(result[1].startTime).toBe(4.2);
        expect(result[1].endTime).toBe(6.8);
        expect(result[1].text).toBe('This is a test subtitle\nAcross two lines');
    });

    it('should handle empty or whitespace-only content', () => {
        expect(parseSrt('')).toEqual([]);
        expect(parseSrt('   \n\n  ')).toEqual([]);
    });

    it('should split subtitles that are longer than 8 words', () => {
        const srtContent = `1
00:00:00,000 --> 00:00:10,000
This is a very long text sentence that contains more than eight words to trigger the chunking.`;

        const result = parseSrt(srtContent);

        // "This is a very long text sentence that" (8 words)
        // "contains more than eight words to trigger the" (8 words)
        // "chunking." (1 word)
        expect(result.length).toBe(3);

        expect(result[0].text).toBe('This is a very long text sentence that');
        expect(result[0].startTime).toBe(0);
        expect(result[0].endTime).toBeCloseTo(4.043, 2); // Roughly proportional

        expect(result[1].text).toBe('contains more than eight words to trigger the');
        expect(result[1].startTime).toBeCloseTo(4.043, 2);
        expect(result[1].endTime).toBeCloseTo(8.83, 2);

        expect(result[2].text).toBe('chunking.');
        expect(result[2].startTime).toBeCloseTo(8.83, 2);
        expect(result[2].endTime).toBe(10.0);
    });

    it('should skip malformed blocks', () => {
        const srtContent = `1
00:00:01,000 --> 00:00:03,500
Valid block

2
Invalid timecode line
Missing arrows

3
00:00:10,000 --> 00:00:12,000
Another valid block`;

        const result = parseSrt(srtContent);
        expect(result.length).toBe(2);
        expect(result[0].text).toBe('Valid block');
        expect(result[1].text).toBe('Another valid block');
    });
});
