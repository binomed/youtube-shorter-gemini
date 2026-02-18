// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { ProgressService } from './progress.service';
import { firstValueFrom, take, toArray } from 'rxjs';

describe('ProgressService', () => {
  let service: ProgressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProgressService],
    }).compile();

    service = module.get<ProgressService>(ProgressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('emitProgress', () => {
    it('should emit progress event to stream', async () => {
      const projectId = 'test-project-123';

      // Subscribe before emitting
      const streamPromise = firstValueFrom(
        service.getProgressStream(projectId),
      );

      // Emit progress
      service.emitProgress(projectId, 'received', 25, 'File received');

      // Verify event
      const event = await streamPromise;
      expect(event.projectId).toBe(projectId);
      expect(event.type).toBe('received');
      expect(event.progress).toBe(25);
      expect(event.message).toBe('File received');
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should emit multiple events in sequence', (done) => {
      const projectId = 'test-project-456';
      const events: any[] = [];

      // Subscribe to stream
      service
        .getProgressStream(projectId)
        .pipe(take(3), toArray())
        .subscribe({
          next: (collectedEvents) => {
            expect(collectedEvents).toHaveLength(3);
            expect(collectedEvents[0].progress).toBe(25);
            expect(collectedEvents[1].progress).toBe(50);
            expect(collectedEvents[2].progress).toBe(100);
            done();
          },
        });

      // Emit events
      service.emitProgress(projectId, 'received', 25, 'File received');
      service.emitProgress(projectId, 'processing', 50, 'Extracting metadata');
      service.emitProgress(projectId, 'complete', 100, 'Complete');
    });

    it('should clamp progress to 0-100 range', async () => {
      const projectId = 'test-project-clamp';

      const streamPromise = firstValueFrom(
        service.getProgressStream(projectId).pipe(take(2), toArray()),
      );

      service.emitProgress(projectId, 'received', -10, 'Negative');
      service.emitProgress(projectId, 'processing', 150, 'Over 100');

      const events = await streamPromise;
      expect(events[0].progress).toBe(0); // Clamped from -10
      expect(events[1].progress).toBe(100); // Clamped from 150
    });
  });

  describe('emitError', () => {
    it('should emit error event', async () => {
      const projectId = 'test-project-error';

      const streamPromise = firstValueFrom(
        service.getProgressStream(projectId),
      );

      service.emitError(projectId, 'Something went wrong');

      const event = await streamPromise;
      expect(event.type).toBe('error');
      expect(event.message).toBe('Something went wrong');
    });
  });

  describe('hasStream', () => {
    it('should return true if stream exists', () => {
      const projectId = 'test-project-exists';

      expect(service.hasStream(projectId)).toBe(false);

      service.getProgressStream(projectId);

      expect(service.hasStream(projectId)).toBe(true);
    });
  });

  describe('getActiveStreamCount', () => {
    it('should return count of active streams', () => {
      expect(service.getActiveStreamCount()).toBe(0);

      service.getProgressStream('project-1');
      expect(service.getActiveStreamCount()).toBe(1);

      service.getProgressStream('project-2');
      expect(service.getActiveStreamCount()).toBe(2);
    });
  });
});
