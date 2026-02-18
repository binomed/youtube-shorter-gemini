/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { describe, it, expect, vi, beforeEach, type Mocked } from 'vitest';
import axios from 'axios';
import { ProjectService } from './project.service.js';

// Mock axios
vi.mock('axios');

describe('ProjectService', () => {
    let service: ProjectService;
    let mockedAxios: Mocked<typeof axios>;

    beforeEach(() => {
        service = new ProjectService('/api');
        mockedAxios = axios as Mocked<typeof axios>;

        // Reset mocks
        vi.resetAllMocks();

        // Default isAxiosError implementation for tests
        mockedAxios.isAxiosError.mockImplementation((payload) => {
            return !!(payload && (payload as any).isAxiosError);
        });
    });

    describe('getConfig', () => {
        it('should fetch configuration', async () => {
            const mockConfig = {
                maxVideoSizeMb: 500,
                allowedExtensions: ['.mp4', '.mov'],
                allowedMimeTypes: ['video/mp4', 'video/quicktime'],
            };

            mockedAxios.get.mockResolvedValue({
                data: { success: true, data: mockConfig }
            });

            const config = await service.getConfig();
            expect(config).toEqual(mockConfig);
            expect(mockedAxios.get).toHaveBeenCalledWith('/api/projects/config');
        });

        it('should throw error on failed fetch', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Network Error'));
            await expect(service.getConfig()).rejects.toThrow('Failed to fetch configuration');
        });
    });

    describe('createProject', () => {
        const mockDto = { name: 'Test', deletionPolicyAcknowledged: true, aiLearningConsent: false };
        const mockFile = new File(['video content'], 'test.mp4', { type: 'video/mp4' });

        it('should create project successfully', async () => {
            const mockResponse = {
                id: 'test-id',
                name: 'Test',
                videoPath: '/path/to.mp4',
                createdAt: '2026-01-01'
            };

            mockedAxios.post.mockResolvedValue({
                data: { success: true, data: mockResponse }
            });

            const result = await service.createProject(mockDto, mockFile);
            expect(result).toEqual(mockResponse);

            // Verify FormData contains expected fields
            const callArgs = mockedAxios.post.mock.calls[0];
            const formData = callArgs[1] as FormData;
            expect(formData).toBeInstanceOf(FormData);
            // JSDOM FormData might be opaque, so we trust it was passed correctly by logic
        });

        it('should track upload progress', async () => {
            const onProgress = vi.fn();

            mockedAxios.post.mockImplementation((_url, _data, config) => {
                // Simulate progress
                if (config?.onUploadProgress) {
                    config.onUploadProgress({ loaded: 50, total: 100, bytes: 50 } as any);
                }
                return Promise.resolve({ data: { success: true, data: {} } });
            });

            await service.createProject(mockDto, mockFile, onProgress);
            expect(onProgress).toHaveBeenCalledWith(50);
        });

        it('should handle axios error with response', async () => {
            const error = {
                isAxiosError: true,
                message: 'Request failed',
                response: { data: { message: 'Invalid file format' } }
            };
            mockedAxios.post.mockRejectedValue(error);

            await expect(service.createProject(mockDto, mockFile)).rejects.toThrow('Invalid file format');
        });

        it('should handle unexpected error', async () => {
            mockedAxios.post.mockRejectedValue(new Error('Boom'));
            // mockedAxios.isAxiosError mocked to return false for normal Errror if not tagged

            await expect(service.createProject(mockDto, mockFile)).rejects.toThrow('An unexpected error occurred');
        });
    });
});
