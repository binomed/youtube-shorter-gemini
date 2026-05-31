// Copyright (c) 2026 YouTube Shorter Gemini. All rights reserved.
// Licensed under the Apache-2.0 License. See LICENSE file in the project root for full license information.

/**
 * Information about a Gemini model for the selection dropdown.
 */
export interface GeminiModelInfo {
  name: string;
  code: string;
  pricing: string;
}

/**
 * Application-wide settings.
 */
export interface AppSettings {
  geminiModel: string;
  frameInterval: number;
  customPrompt?: string;
  minDuration?: number;
  maxDuration?: number;
}
