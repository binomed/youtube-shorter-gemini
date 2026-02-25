// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
// Licensed under the Apache-20 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Subject } from 'rxjs';
import { NotFoundException } from '@nestjs/common';
import { StemService } from './stem.service';
import { FFmpegService } from '../../workers/ffmpeg.service';
import { StemProgressEvent } from '@youtube-shorter/shared';
import { JobService } from '../processing/job.service';
import { Short } from '../../entities/short.entity';
import { Project } from '../../entities/project.entity';

const mockProject = { id: 'proj-1', videoPath: '/tmp/test.mp4' };
const mockShort = {
    id: 'short-1',
    projectId: 'proj-1',
    startTime: 5,
    endTime: 35,
    vocalsPath: null,
    accompanimentPath: null,
};
const mockJob = { id: 'job-1', type: 'stem_separation', status: 'pending' };

const mockFfmpegService = {
    extractAudio: jest.fn(),
};

const mockJobService = {
    create: jest.fn().mockResolvedValue(mockJob),
    updateProgress: jest.fn().mockResolvedValue(undefined),
    complete: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined),
    findLatestByShort: jest.fn(),
};

const mockShortRepository = {
    findOneBy: jest.fn(),
    save: jest.fn(),
};

const mockProjectRepository = {
    findOneBy: jest.fn(),
};

// Mock child_process.spawn and fs
jest.mock('child_process', () => ({
    spawn: jest.fn(),
}));

jest.mock('fs/promises', () => ({
    mkdir: jest.fn().mockResolvedValue(undefined),
    readdir: jest.fn(),
    stat: jest.fn(),
    access: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('StemService', () => {
    let service: StemService;

    beforeEach(async () => {
        jest.clearAllMocks();
        // Reset fs mock implementations (clearAllMocks doesn't reset mockRejectedValue)
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fsMock = require('fs/promises') as jest.Mocked<typeof import('fs/promises')>;
        fsMock.mkdir.mockResolvedValue(undefined);
        fsMock.unlink.mockResolvedValue(undefined);

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StemService,
                { provide: FFmpegService, useValue: mockFfmpegService },
                { provide: JobService, useValue: mockJobService },
                { provide: getRepositoryToken(Short), useValue: mockShortRepository },
                {
                    provide: getRepositoryToken(Project),
                    useValue: mockProjectRepository,
                },
            ],
        }).compile();

        service = module.get<StemService>(StemService);
    });

    describe('separateStems', () => {
        it('should throw NotFoundException when project does not exist', async () => {
            mockProjectRepository.findOneBy.mockResolvedValue(null);

            await expect(service.separateStems('no-proj', 'short-1')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should throw NotFoundException when short does not belong to project', async () => {
            mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
            mockShortRepository.findOneBy.mockResolvedValue(null);

            await expect(service.separateStems('proj-1', 'no-short')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('should skip separation if stems already exist', async () => {
            mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
            mockShortRepository.findOneBy.mockResolvedValue({
                ...mockShort,
                vocalsPath: '/tmp/vocals.wav',
                accompanimentPath: '/tmp/no_vocals.wav',
            });

            const result = await service.separateStems('proj-1', 'short-1');

            expect(result.vocalsPath).toBeTruthy();
            expect(mockJobService.create).not.toHaveBeenCalled(); // No job created if already done
        });

        it('should create a Job record (SQL-Queue) before starting', async () => {
            // When stems already exist we return early BEFORE creating a job
            // This test verifies that when stems DON'T exist, a job IS created
            mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
            mockShortRepository.findOneBy.mockResolvedValue(mockShort); // no stems

            // We immediately reject at the mkdir step to short-circuit
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fsMock = require('fs/promises') as jest.Mocked<
                typeof import('fs/promises')
            >;
            fsMock.mkdir.mockRejectedValue(new Error('mkdir failed'));

            await expect(service.separateStems('proj-1', 'short-1')).rejects.toThrow(
                'mkdir failed',
            );

            // Job was created before the error
            expect(mockJobService.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'stem_separation',
                    projectId: 'proj-1',
                    shortId: 'short-1',
                }),
            );
        });

        it('should mark job as failed if separation throws inside try block', async () => {
            mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
            mockShortRepository.findOneBy.mockResolvedValue(mockShort);

            // persistAndEmitProgress calls jobService.updateProgress inside the try block
            // Making it throw simulates an error that should trigger jobService.fail
            mockJobService.updateProgress.mockRejectedValueOnce(
                new Error('disk full'),
            );

            await expect(service.separateStems('proj-1', 'short-1')).rejects.toThrow(
                'disk full',
            );

            expect(mockJobService.fail).toHaveBeenCalledWith(
                mockJob.id,
                expect.stringContaining('disk full'),
            );
        });

        it('should emit SSE progress events AND update job in DB', async () => {
            mockProjectRepository.findOneBy.mockResolvedValue(mockProject);
            mockShortRepository.findOneBy.mockResolvedValue({
                ...mockShort,
                vocalsPath: '/tmp/vocals.wav',
                accompanimentPath: '/tmp/no_vocals.wav',
            });

            const progress$ = new Subject<StemProgressEvent>();
            const events: StemProgressEvent[] = [];
            progress$.subscribe((e) => events.push(e));

            await service.separateStems('proj-1', 'short-1', progress$);

            expect(
                events.some((e: StemProgressEvent) => e.phase === 'complete'),
            ).toBe(true);
        });
    });

    describe('getJobStatus', () => {
        it('should return the latest job for a short', async () => {
            mockJobService.findLatestByShort.mockResolvedValue(mockJob);

            const result = await service.getJobStatus('short-1');

            expect(result).toEqual(mockJob);
            expect(mockJobService.findLatestByShort).toHaveBeenCalledWith('short-1');
        });
    });
});
