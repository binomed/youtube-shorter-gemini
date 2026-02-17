// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

import { basename, extname, resolve } from 'path';

/**
 * Utility functions for file path validation and sanitization
 */

/**
 * Sanitize file path to prevent path traversal attacks
 * 
 * @param filePath - Path to sanitize
 * @returns Sanitized path (basename only) or throws if invalid
 * @throws Error if path contains dangerous characters
 */
export function sanitizeFilePath(filePath: string): string {
    if (!filePath) {
        throw new Error('File path cannot be empty');
    }

    // Remove any path traversal attempts
    const sanitized = basename(filePath);

    // Check for dangerous characters
    if (sanitized.includes('..') || sanitized.includes('\0')) {
        throw new Error('Invalid file path: contains dangerous characters');
    }

    return sanitized;
}

/**
 * Validate that file path is absolute and safe
 * 
 * @param filePath - Path to validate
 * @returns Resolved absolute path
 * @throws Error if path is not absolute or unsafe
 */
export function validateAbsolutePath(filePath: string): string {
    const resolved = resolve(filePath);

    // Ensure path is absolute
    if (!resolved.startsWith('/')) {
        throw new Error('File path must be absolute');
    }

    return resolved;
}

/**
 * Validate file extension against allowed list
 * 
 * @param filePath - File path to check
 * @param allowedExtensions - Array of allowed extensions (e.g., ['.mp4', '.mov'])
 * @returns true if valid
 * @throws Error if extension not allowed
 */
export function validateFileExtension(filePath: string, allowedExtensions: string[]): boolean {
    const ext = extname(filePath).toLowerCase();

    if (!allowedExtensions.includes(ext)) {
        throw new Error(`Invalid file extension: ${ext}. Allowed: ${allowedExtensions.join(', ')}`);
    }

    return true;
}
