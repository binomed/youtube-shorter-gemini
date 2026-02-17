// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { CleanupService } from './cleanup.service';

describe('CleanupService', () => {
    let service: CleanupService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [CleanupService],
        }).compile();

        service = module.get<CleanupService>(CleanupService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('deleteProject', () => {
        it('should delete project by ID', async () => {
            const projectId = 'test-project-123';

            // TODO: Add expectations when TypeORM repository is available
            // For now, just verify it doesn't throw
            await expect(service.deleteProject(projectId)).resolves.not.toThrow();
        });
    });

    describe('deleteAllProjects', () => {
        it('should delete all projects', async () => {
            // TODO: Add expectations when TypeORM repository is available
            await expect(service.deleteAllProjects()).resolves.not.toThrow();
        });
    });

    describe('cleanupInactive', () => {
        it('should cleanup inactive projects (no-op for Story 1.1)', async () => {
            const maxAgeHours = 24;

            // Story 1.1: This is a no-op, verify it doesn't throw
            await expect(service.cleanupInactive(maxAgeHours)).resolves.not.toThrow();
        });
    });
});
