// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

/**
 * Standard error response DTO for API errors
 */
export interface ErrorResponse {
    /** HTTP status code */
    statusCode: number;

    /** Error message for display */
    message: string | string[];

    /** Error type/code for programmatic handling */
    error: string;

    /** Timestamp of error */
    timestamp: string;

    /** Request path that caused error */
    path?: string;
}

/**
 * Validation error details
 */
export interface ValidationError {
    field: string;
    message: string;
    value?: unknown;
}

/**
 * Validation error response
 */
export interface ValidationErrorResponse extends ErrorResponse {
    /** Detailed validation errors per field */
    validationErrors?: ValidationError[];
}
