// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-20 License. See LICENSE file in the project root for full license information.

import { Injectable, Logger } from '@nestjs/common';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { join } from 'path';
import * as https from 'https';

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
 * FFmpegService handles video metadata extraction using ffmpeg.wasm
 * 
 * Uses @ffmpeg/ffmpeg (WebAssembly) for zero-config setup without
 * requiring system FFmpeg installation.
 * 
 * Design Decision: Using ffmpeg.wasm for developer experience and
 * cross-platform compatibility. Performance to be evaluated in future epic.
 * 
 * Performance Optimization: WASM binaries (~30MB) are cached locally
 * in .cache/ffmpeg/{version}/ to avoid re-downloading on every app restart.
 * First launch downloads from unpkg.com, subsequent launches load from disk.
 * 
 * @service
 */
@Injectable()
export class FFmpegService {
    private readonly logger = new Logger(FFmpegService.name);
    private readonly ffmpegVersion = '0.12.6';
    private readonly cacheDir = join(process.cwd(), '.cache', 'ffmpeg', this.ffmpegVersion);
    private ffmpeg: FFmpeg;
    private loaded = false;

    constructor() {
        this.ffmpeg = new FFmpeg();

        // Log FFmpeg output for debugging
        this.ffmpeg.on('log', ({ message }) => {
            this.logger.debug(`FFmpeg: ${message}`);
        });
    }

    /**
     * Check if a file exists on disk
     */
    private async fileExists(path: string): Promise<boolean> {
        try {
            await access(path);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Download a file from a URL and save it to disk
     */
    private async downloadFile(url: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = require('fs').createWriteStream(dest);
            https.get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                require('fs').unlink(dest, () => { }); // Delete partial file
                reject(err);
            });
        });
    }

    /**
     * Load FFmpeg from cached files on disk
     * 
     * Reads WASM binaries from cache, creates Blob URLs, and loads into FFmpeg instance.
     */
    private async loadFromCachedFiles(coreFile: string, wasmFile: string): Promise<void> {
        const coreData = await readFile(coreFile);
        const wasmData = await readFile(wasmFile);

        // Create Blob URLs from cached files
        const coreBlob = new Blob([coreData], { type: 'text/javascript' });
        const wasmBlob = new Blob([wasmData], { type: 'application/wasm' });

        await this.ffmpeg.load({
            coreURL: URL.createObjectURL(coreBlob),
            wasmURL: URL.createObjectURL(wasmBlob),
        });
    }

    /**
     * Load FFmpeg WebAssembly core
     * 
     * Performance Optimization: Uses local file system cache to avoid
     * re-downloading ~30MB on every app restart.
     * 
     * Flow:
     * 1. Check if WASM files exist in .cache/ffmpeg/{version}/
     * 2. If yes: Load from local cache (instant)
     * 3. If no: Download from unpkg.com, save to cache, then load
     * 
     * This is called once before first use. Subsequent calls are no-ops.
     */
    private async loadFFmpeg(): Promise<void> {
        if (this.loaded) {
            return;
        }

        try {
            const coreFile = join(this.cacheDir, 'ffmpeg-core.js');
            const wasmFile = join(this.cacheDir, 'ffmpeg-core.wasm');

            const coreExists = await this.fileExists(coreFile);
            const wasmExists = await this.fileExists(wasmFile);

            if (coreExists && wasmExists) {
                // Load from local cache
                this.logger.log(`Loading FFmpeg from cache (${this.cacheDir})...`);

                await this.loadFromCachedFiles(coreFile, wasmFile);
            } else {
                // Download and cache
                this.logger.log('Downloading FFmpeg WASM binaries (first time, ~30MB)...');

                // Ensure cache directory exists
                await mkdir(this.cacheDir, { recursive: true });

                const baseURL = `https://unpkg.com/@ffmpeg/core@${this.ffmpegVersion}/dist/esm`;

                // Download files
                await this.downloadFile(`${baseURL}/ffmpeg-core.js`, coreFile);
                await this.downloadFile(`${baseURL}/ffmpeg-core.wasm`, wasmFile);

                this.logger.log('FFmpeg binaries downloaded and cached');

                // Load from cache
                // Load from newly cached files
                await this.loadFromCachedFiles(coreFile, wasmFile);
            }

            this.loaded = true;
            this.logger.log('FFmpeg loaded successfully');
        } catch (error) {
            this.logger.error('Failed to load FFmpeg', error);
            throw new Error(`FFmpeg initialization failed: ${error.message}`);
        }
    }

    /**
     * Extract video metadata from file
     * 
     * Reads video file and extracts:
     * - Duration (seconds)
     * - Resolution (widthxheight, e.g., "1920x1080")
     * - Video codec (e.g., "h264")
     * - Dimensions (width, height)
     * 
     * @param videoPath - Absolute path to video file
     * @returns Video metadata
     * @throws Error if metadata extraction fails
     * 
     * @example
     * const metadata = await ffmpegService.extractMetadata('/path/to/video.mp4');
     * // { duration: 120.5, resolution: "1920x1080", codec: "h264", width: 1920, height: 1080 }
     */
    async extractMetadata(videoPath: string): Promise<VideoMetadata> {
        await this.loadFFmpeg();

        try {
            this.logger.log(`Extracting metadata from: ${videoPath}`);

            // Read video file from disk
            const videoData = await readFile(videoPath);

            // Write to FFmpeg virtual filesystem
            const inputFileName = 'input.mp4';
            await this.ffmpeg.writeFile(inputFileName, new Uint8Array(videoData));

            // Run ffprobe command to get metadata in JSON format
            // -v error: suppress warnings
            // -show_format: display format/container info (duration)
            // -show_streams: display stream info (codec, resolution)
            // -of json: output as JSON
            await this.ffmpeg.exec([
                '-i', inputFileName,
                '-v', 'error',
                '-show_format',
                '-show_streams',
                '-of', 'json',
                'metadata.json',
            ]);

            // Read metadata output
            const metadataBuffer = await this.ffmpeg.readFile('metadata.json');
            const metadataJson = new TextDecoder().decode(metadataBuffer);
            const metadata = JSON.parse(metadataJson);

            // Extract video stream
            const videoStream = metadata.streams?.find(
                (stream: any) => stream.codec_type === 'video',
            );

            if (!videoStream) {
                throw new Error('No video stream found in file');
            }

            // Parse metadata
            const duration = parseFloat(metadata.format?.duration || '0');
            const width = videoStream.width || 0;
            const height = videoStream.height || 0;
            const codec = videoStream.codec_name || 'unknown';
            const resolution = `${width}x${height}`;

            // Cleanup virtual filesystem
            await this.ffmpeg.deleteFile(inputFileName);
            await this.ffmpeg.deleteFile('metadata.json');

            this.logger.log(`Metadata extracted: ${duration}s, ${resolution}, ${codec}`);

            return {
                duration,
                resolution,
                codec,
                width,
                height,
            };
        } catch (error) {
            this.logger.error(`Metadata extraction failed: ${error.message}`);
            throw new Error(`Failed to extract video metadata: ${error.message}`);
        }
    }
}
