/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import axios, { type AxiosRequestConfig } from 'axios';
import { CreateProjectDto, type ProjectResponse } from '@youtube-shorter/shared';

/**
 * API response wrapper from backend
 */
interface ApiResponse<T> {
    success: boolean;
    data: T;
}

/**
 * Progress callback type for upload tracking (0-100)
 */
export type UploadProgressCallback = (percentage: number) => void;

/**
 * ProjectService handles communication with the backend API
 *
 * Uses Axios for robust HTTP requests and upload progress tracking.
 * Provides methods for configuration retrieval and project creation.
 *
 * @service
 */
export class ProjectService {
    private readonly baseUrl: string;

    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }

    /**
     * Get upload configuration from backend
     *
     * Fetches dynamic limits (max file size) and allowed formats from the server.
     * This ensures the frontend validation matches backend logic.
     *
     * @returns Configuration object
     * @throws Error if configuration cannot be loaded
     */
    async getConfig(): Promise<{
        maxVideoSizeMb: number;
        allowedExtensions: string[];
        allowedMimeTypes: string[];
    }> {
        try {
            const response = await axios.get<ApiResponse<{
                maxVideoSizeMb: number;
                allowedExtensions: string[];
                allowedMimeTypes: string[];
            }>>(`${this.baseUrl}/projects/config`);
            return response.data.data;
        } catch (error) {
            console.error('Failed to fetch config:', error);
            throw new Error('Failed to fetch configuration');
        }
    }

    /**
     * Create a new project by uploading a video file
     *
     * Uploads the video file along with metadata (name, consent flags) using multipart/form-data.
     * Tracks upload progress via Axios's onUploadProgress event.
     *
     * @param dto - Project creation DTO (name, consents)
     * @param videoFile - Video file to upload
     * @param onProgress - Optional callback for upload progress (0-100)
     * @returns Created project data
     * @throws Error if upload fails or server returns an error
     */
    async createProject(
        dto: CreateProjectDto,
        videoFile: File,
        onProgress?: UploadProgressCallback,
    ): Promise<ProjectResponse> {
        const formData = new FormData();

        formData.append('name', dto.name);
        formData.append('deletionPolicyAcknowledged', String(dto.deletionPolicyAcknowledged));

        if (dto.aiLearningConsent !== undefined) {
            formData.append('aiLearningConsent', String(dto.aiLearningConsent));
        }

        formData.append('videoFile', videoFile);

        try {
            const config: AxiosRequestConfig = {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    if (onProgress && progressEvent.total) {
                        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        onProgress(percent);
                    }
                },
            };

            const response = await axios.post<ApiResponse<ProjectResponse>>(
                `${this.baseUrl}/projects`,
                formData,
                config
            );

            return response.data.data;
        } catch (error: any) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Upload failed';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred during upload');
        }
    }
}

/** Singleton instance */
export const projectService = new ProjectService();
