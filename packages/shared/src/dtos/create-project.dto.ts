// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { IsNotEmpty, MaxLength } from 'class-validator';

/**
 * DTO for creating a new project
 */
export class CreateProjectDto {
    @IsNotEmpty({ message: 'Project name is required' })
    @MaxLength(255, { message: 'Project name cannot exceed 255 characters' })
    name!: string; // Non-null assertion - will be validated by class-validator
}
