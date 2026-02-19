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

/**
 * Validate file extension against allowed list
 *
 * @param filePath - File path to check
 * @param allowedExtensions - Array of allowed extensions (e.g., ['.mp4', '.mov'])
 * @returns true if valid
 * @throws Error if extension not allowed
 */
export function validateFileExtension(
  filePath: string,
  allowedExtensions: string[],
): boolean {
  const ext = extname(filePath).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    throw new Error(
      `Invalid file extension: ${ext}. Allowed: ${allowedExtensions.join(', ')}`,
    );
  }

  return true;
}

import { open } from 'fs/promises';

/**
 * Validate file content using magic bytes (file signature)
 * 
 * Securely checks the first few bytes of the file to verify it matches
 * expected video container formats (MP4, MOV, AVI, MKV).
 * This prevents extension spoofing attacks (e.g., malware.exe renamed to video.mp4).
 * 
 * @param filePath - Absolute path to the file
 * @returns true if signature is valid
 * @throws Error if signature is invalid or file reading fails
 */
export async function validateFileSignature(filePath: string): Promise<boolean> {
  let fileHandle;
  try {
    fileHandle = await open(filePath, 'r');
    const buffer = Buffer.alloc(12); // Read enough for header checks
    // read(buffer, offset, length, position)
    await fileHandle.read(buffer, 0, 12, 0);

    // Convert to hex string for easier matching
    const hex = buffer.toString('hex').toUpperCase();

    // Check Signatures

    // 1. MP4 / MOV (ISO Base Media File Format)
    // Offset 4 contains 'ftyp' (66 74 79 70)
    if (hex.slice(8, 16) === '66747970') {
      return true;
    }

    // 2. AVI (RIFF + AVI )
    // Offset 0: 'RIFF' (52 49 46 46)
    // Offset 8: 'AVI ' (41 56 49 20)
    if (hex.startsWith('52494646') && hex.slice(16, 24) === '41564920') {
      return true;
    }

    // 3. MKV (Matroska)
    // Offset 0: EBML signature (1A 45 DF A3)
    if (hex.startsWith('1A45DFA3')) {
      return true;
    }

    throw new Error('Invalid file signature. File content does not match allowed video formats.');
  } catch (error) {
    throw new Error(`File validation failed: ${error.message}`);
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}
