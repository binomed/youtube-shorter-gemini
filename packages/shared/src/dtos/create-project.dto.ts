/*
 * Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
 * Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.
 */
import { IsBoolean, IsNotEmpty, IsOptional, MaxLength, Equals, IsString, IsNumber } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for creating a new project
 */
export class CreateProjectDto {
    @IsNotEmpty({ message: 'Project name is required' })
    @MaxLength(255, { message: 'Project name cannot exceed 255 characters' })
    name!: string;

    @IsBoolean({ message: 'Deletion policy acknowledgement must be a boolean' })
    @Equals(true, { message: 'You must acknowledge the data deletion policy' })
    @Transform(({ value }) => value === 'true' || value === true)
    deletionPolicyAcknowledged!: boolean;

    @IsOptional()
    @IsBoolean({ message: 'AI learning consent must be a boolean' })
    @Transform(({ value }) => value === 'true' || value === true)
    aiLearningConsent: boolean = false;

    @IsOptional()
    @IsString()
    customPrompt?: string;

    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
    minDuration?: number;

    @IsOptional()
    @IsNumber()
    @Transform(({ value }) => value !== undefined ? Number(value) : undefined)
    maxDuration?: number;
}
