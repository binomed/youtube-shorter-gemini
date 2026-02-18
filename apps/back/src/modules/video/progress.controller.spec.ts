// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { Test, TestingModule } from '@nestjs/testing';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { firstValueFrom, Subject } from 'rxjs';

describe('ProgressController', () => {
  let controller: ProgressController;
  let progressService: ProgressService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgressController],
      providers: [
        {
          provide: ProgressService,
          useValue: {
            getProgressStream: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ProgressController>(ProgressController);
    progressService = module.get<ProgressService>(ProgressService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('progress', () => {
    it('should return SSE observable from ProgressService', async () => {
      const projectId = 'test-project-123';
      const mockEvent = {
        projectId,
        type: 'received' as const,
        progress: 25,
        message: 'File received',
        timestamp: new Date(),
      };

      const mockSubject = new Subject<any>();
      jest
        .spyOn(progressService, 'getProgressStream')
        .mockReturnValue(mockSubject.asObservable());

      const observable = controller.progress(projectId);
      const eventPromise = firstValueFrom(observable);

      // Emit mock event
      mockSubject.next(mockEvent);

      const result = await eventPromise;

      expect(progressService.getProgressStream).toHaveBeenCalledWith(projectId);
      expect(result.data).toEqual(mockEvent);
    });
  });
});
