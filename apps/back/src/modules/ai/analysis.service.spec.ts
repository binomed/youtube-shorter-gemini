// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Subject } from 'rxjs';
import { NotFoundException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { GeminiService } from './gemini.service';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';
import type { AnalysisProgressEvent } from '@youtube-shorter/shared';

const mockProject = {
    id: 'proj-1',
    name: 'Test Project',
    videoPath: '/tmp/test.mp4',
    createdAt: new Date(),
};

const mockShort = {
    id: 'short-1',
    projectId: 'proj-1',
    title: 'Test Short',
    startTime: 10,
    endTime: 40,
    score: 0.9,
    reasoning: 'High energy',
};

const mockGeminiService = {
    detectShortsCandidates: jest.fn(),
    generateSubtitles: jest.fn(),
};

const mockFfmpegService = {
    extractMetadata: jest.fn(),
    extractThumbnail: jest.fn(),
    extractAudio: jest.fn(),
};

const mockProjectRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
};

const mockShortRepository = {
    save: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
    findOneBy: jest.fn(),
};

describe('AnalysisService', () => {
    let service: AnalysisService;

    beforeEach(async () => {
        jest.clearAllMocks();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AnalysisService,
                { provide: GeminiService, useValue: mockGeminiService },
                { provide: FFmpegService, useValue: mockFfmpegService },
                { provide: ConfigService, useValue: { get: jest.fn((key: string) => key === 'TEMP_DIR' ? '/tmp' : undefined) } },
                { provide: getRepositoryToken(Short), useValue: mockShortRepository },
                { provide: getRepositoryToken(Project), useValue: mockProjectRepository },
            ],
        }).compile();

        service = module.get<AnalysisService>(AnalysisService);
    });

    describe('analyzeProject', () => {
        it('should throw NotFoundException when project does not exist', async () => {
            mockProjectRepository.findOneBy.mockResolvedValue(null);

            await expect(service.analyzeProject('nonexistent')).rejects.toThrow(NotFoundException);
        });

        it('should call GeminiService and save resulting shorts', async () => {
            mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
            mockFfmpegService.extractMetadata.mockResolvedValue({ duration: 120, width: 1920, height: 1080, codec: 'h264', resolution: '1920x1080' });
            mockGeminiService.detectShortsCandidates.mockResolvedValue([
                { title: 'Best moment', startTime: 10, endTime: 40, score: 0.9, reasoning: 'High energy' },
            ]);
            mockFfmpegService.extractThumbnail.mockResolvedValue(undefined);
            mockShortRepository.save.mockImplementation((s: any) => ({ ...s, id: 'short-1' }));
            mockFfmpegService.extractAudio.mockResolvedValue(undefined);
            mockGeminiService.generateSubtitles.mockResolvedValue(null);

            const result = await service.analyzeProject('proj-1');

            expect(mockGeminiService.detectShortsCandidates).toHaveBeenCalled();
            expect(mockShortRepository.save).toHaveBeenCalled();
            expect(result).toHaveLength(1);
        });

        it('should emit SSE progress events when Subject is provided', async () => {
            mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
            mockFfmpegService.extractMetadata.mockResolvedValue({ duration: 60, width: 1280, height: 720, codec: 'h264', resolution: '1280x720' });
            mockGeminiService.detectShortsCandidates.mockResolvedValue([]);
            mockFfmpegService.extractAudio.mockResolvedValue(undefined);
            mockGeminiService.generateSubtitles.mockResolvedValue(null);

            const progress$ = new Subject<AnalysisProgressEvent>();
            const events: AnalysisProgressEvent[] = [];
            progress$.subscribe(e => events.push(e));

            await service.analyzeProject('proj-1', progress$);

            expect(events.length).toBeGreaterThan(0);
        });

        it('should continue analysis even if transcription fails', async () => {
            mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
            mockFfmpegService.extractMetadata.mockResolvedValue({ duration: 60, width: 1280, height: 720, codec: 'h264', resolution: '1280x720' });
            mockGeminiService.detectShortsCandidates.mockResolvedValue([]);
            // extractAudio fails → transcription should be skipped, not crash
            mockFfmpegService.extractAudio.mockRejectedValue(new Error('ffmpeg not found'));
            mockGeminiService.generateSubtitles.mockRejectedValue(new Error('API error'));

            // Should NOT throw — transcription failure is non-fatal
            await expect(service.analyzeProject('proj-1')).resolves.toBeDefined();
        });
    });
});
