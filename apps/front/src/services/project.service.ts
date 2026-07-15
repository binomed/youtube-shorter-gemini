/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import axios, { type AxiosRequestConfig } from 'axios';
import { type CreateProjectDto, type ProjectResponse, type ShortResponse, type AnalysisResponse } from '@youtube-shorter/shared';

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
 * Provides methods for configuration retrieval, project creation,
 * and AI analysis.
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

        if (dto.customPrompt !== undefined) {
            formData.append('customPrompt', dto.customPrompt);
        }

        if (dto.minDuration !== undefined) {
            formData.append('minDuration', String(dto.minDuration));
        }

        if (dto.maxDuration !== undefined) {
            formData.append('maxDuration', String(dto.maxDuration));
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
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Upload failed';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred during upload');
        }
    }

    /**
     * Trigger AI analysis for a project's video.
     * The analysis runs server-side (FFmpeg → Gemini → DB).
     *
     * @param projectId - UUID of the project
     * @returns Analysis result with detected shorts
     */
    async analyzeProject(projectId: string): Promise<AnalysisResponse> {
        try {
            const response = await axios.post<AnalysisResponse>(
                `${this.baseUrl}/projects/${projectId}/analyze`
            );
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Analysis failed';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred during analysis');
        }
    }

    /**
     * Manually create a custom Short instantly.
     *
     * @param projectId - UUID of the project
     * @returns The created short
     */
    async createShort(projectId: string): Promise<ShortResponse> {
        try {
            const response = await axios.post<ShortResponse>(
                `${this.baseUrl}/projects/${projectId}/shorts`
            );
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Failed to create custom short';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred during short creation');
        }
    }

    /**
     * Get existing shorts for a project.
     *
     * @param projectId - UUID of the project
     * @returns Array of shorts
     */
    async getShorts(projectId: string): Promise<ShortResponse[]> {
        try {
            const response = await axios.get<ShortResponse[]>(
                `${this.baseUrl}/projects/${projectId}/shorts`
            );
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Failed to load shorts';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred');
        }
    }

    /**
     * Get all projects
     */
    async getProjects(): Promise<ProjectResponse[]> {
        try {
            const response = await axios.get<ApiResponse<ProjectResponse[]>>(
                `${this.baseUrl}/projects`
            );
            return response.data.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Failed to fetch projects';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred while fetching projects');
        }
    }

    /**
     * Delete a project
     */
    async deleteProject(id: string): Promise<void> {
        try {
            await axios.delete(`${this.baseUrl}/projects/${id}`);
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Failed to delete project';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred while deleting project');
        }
    }

    /**
     * Get project by ID
     *
     * @param id - Project UUID
     * @returns Project data
     */
    async getProject(id: string): Promise<ProjectResponse> {
        try {
            const response = await axios.get<ApiResponse<ProjectResponse>>(
                `${this.baseUrl}/projects/${id}`
            );
            return response.data.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Failed to fetch project';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred while fetching project');
        }
    }

    /**
     * Upload a custom cover image for a specific short.
     *
     * @param projectId - UUID of the project
     * @param shortId - UUID of the short
     * @param blob - JPEG image blob (cropped 1080×1920)
     * @returns Updated ShortResponse with coverImageUrl
     */
    async uploadCoverImage(projectId: string, shortId: string, blob: Blob): Promise<ShortResponse> {
        const formData = new FormData();
        formData.append('cover', blob, 'cover.jpg');

        try {
            const response = await axios.post<ShortResponse>(
                `${this.baseUrl}/projects/${projectId}/shorts/${shortId}/cover`,
                formData,
                {
                    headers: { 'Content-Type': 'multipart/form-data' },
                },
            );
            return response.data;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Failed to upload cover image';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred while uploading cover image');
        }
    }

    /**
     * Delete the custom cover image for a specific short.
     *
     * @param projectId - UUID of the project
     * @param shortId - UUID of the short
     */
    async deleteCoverImage(projectId: string, shortId: string): Promise<void> {
        try {
            await axios.delete(
                `${this.baseUrl}/projects/${projectId}/shorts/${shortId}/cover`,
            );
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.message || 'Failed to delete cover image';
                throw new Error(message);
            }
            throw new Error('An unexpected error occurred while deleting cover image');
        }
    }
}

/** Singleton instance */
export const projectService = new ProjectService();

