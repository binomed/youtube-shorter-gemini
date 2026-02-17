// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * DTO for creating a new project
 * 
 * Used in multipart/form-data requests alongside video file upload
 */
export class CreateProjectDto {
    /**
     * User-provided project name
     * @example "My Awesome Shorts Project"
     */
    @IsNotEmpty({ message: 'Project name is required' })
    @IsString({ message: 'Project name must be a string' })
    @MaxLength(255, { message: 'Project name cannot exceed 255 characters' })
    name: string;
}
