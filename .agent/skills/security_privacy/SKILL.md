---
name: Security & Privacy
description: Zero-persistence media handling and data privacy standards for the YouTube-Shorter-Gemini project
---

# Security & Privacy Custom Skill

## When to Use This Skill

Use this skill for ALL code that handles:
- Video file uploads and processing
- Temporary file management
- API keys and secrets
- User data (project metadata)
- External API communications (Gemini, Ollama)
- File system operations

## Core Principles

### 1. Zero-Persistence for Media Files
This is the **PRIMARY security requirement** for the project:

- **Video files are NEVER stored permanently**
- All media processing uses temporary files (`/tmp`)
- Temp files are deleted immediately after processing
- Only metadata (timestamps, project names) persists in SQLite
- Final renders are delivered to user then deleted

### 2. Local-First Architecture
- Application runs entirely on user's machine
- No cloud storage of videos
- No tracking or analytics
- API calls (Gemini) send only frame samples, not full videos

### 3. Defense in Depth
- Input validation on all file uploads
- Sanitize user-provided filenames
- Limit file sizes and durations
- Environment-based secrets management
- No hardcoded credentials

## Mandatory Patterns & Rules

### File Upload Security

```typescript
import { Controller, Post, UploadedFile, UseInterceptors, BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Secure file upload configuration.
 * Validates file type, size, and sanitizes names.
 */
@Controller('api/upload')
export class UploadController {
  private readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  private readonly ALLOWED_MIMETYPES = [
    'video/mp4',
    'video/quicktime', // .mov
    'video/x-msvideo', // .avi
    'video/webm',
  ];

  @Post()
  @UseInterceptors(FileInterceptor('video', {
    storage: diskStorage({
      destination: '/tmp/yts-uploads',
      filename: (req, file, cb) => {
        // Generate cryptographically random filename
        const randomName = crypto.randomBytes(16).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${randomName}${ext}`);
      },
    }),
    limits: {
      fileSize: 500 * 1024 * 1024, // 500MB
    },
    fileFilter: (req, file, cb) => {
      // Validate MIME type
      if (!this.ALLOWED_MIMETYPES.includes(file.mimetype)) {
        return cb(
          new BadRequestException(
            `Invalid file type. Allowed: ${this.ALLOWED_MIMETYPES.join(', ')}`
          ),
          false,
        );
      }
      cb(null, true);
    },
  }))
  async uploadVideo(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    // Additional size validation
    if (file.size > this.MAX_FILE_SIZE) {
      throw new PayloadTooLargeException('File size exceeds 500MB limit');
    }

    try {
      // Process file (extraction, analysis, etc.)
      const result = await this.processingService.handleUpload(file.path);
      
      return {
        success: true,
        data: result,
      };
    } finally {
      // CRITICAL: Always cleanup uploaded file
      await this.cleanupFile(file.path);
    }
  }

  /**
   * Securely delete file after processing.
   * Logs errors but doesn't throw to avoid masking primary errors.
   */
  private async cleanupFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.log(`Cleaned up file: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to cleanup file ${filePath}: ${error.message}`);
      // Continue - don't throw as this is cleanup
    }
  }
}
```

### Filename Sanitization

```typescript
import * as path from 'path';

/**
 * Sanitize user-provided filenames to prevent path traversal attacks.
 * Removes ../.. patterns, null bytes, and control characters.
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    throw new Error('Invalid filename');
  }

  // Remove path separators and traversal attempts
  let sanitized = filename.replace(/[/\\]/g, '');
  sanitized = sanitized.replace(/\.\./g, '');
  
  // Remove null bytes and control characters
  sanitized = sanitized.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  
  // Limit length
  sanitized = sanitized.slice(0, 255);
  
  // Parse and validate extension
  const ext = path.extname(sanitized);
  const allowedExts = ['.mp4', '.mov', '.avi', '.webm'];
  
  if (!allowedExts.includes(ext.toLowerCase())) {
    throw new Error(`Invalid file extension: ${ext}`);
  }

  return sanitized;
}
```

### Secrets Management

**Configuration Service:**

```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Centralized secrets management.
 * All sensitive values loaded from environment, never hardcoded.
 */
@Injectable()
export class SecretsService {
  constructor(private readonly configService: ConfigService) {
    this.validateRequiredSecrets();
  }

  /**
   * Validate all required secrets are present at startup.
   * Fail fast if configuration is incomplete.
   */
  private validateRequiredSecrets(): void {
    const required = ['GEMINI_API_KEY', 'DATABASE_PATH'];
    const missing = required.filter(key => !this.configService.get(key));

    if (missing.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missing.join(', ')}\n` +
        `Please check your .env file.`
      );
    }
  }

  getGeminiApiKey(): string {
    return this.configService.get<string>('GEMINI_API_KEY')!;
  }

  getDatabasePath(): string {
    return this.configService.get<string>('DATABASE_PATH', './data/yts.db');
  }

  getOllamaUrl(): string {
    return this.configService.get<string>('OLLAMA_URL', 'http://localhost:11434');
  }

  /**
   * Get secret with fallback for optional values.
   */
  getOptionalSecret(key: string, defaultValue: string): string {
    return this.configService.get<string>(key, defaultValue);
  }
}
```

**.env.sample Template:**

```bash
# Copy this file to .env and fill in your values
# NEVER commit .env to version control

# Gemini AI Configuration
GEMINI_API_KEY=your_api_key_here

# Database Location (defaults to ./data/yts.db)
DATABASE_PATH=./data/yts.db

# Ollama (optional, for local AI fallback)
OLLAMA_ENABLED=false
OLLAMA_URL=http://localhost:11434

# Application Settings
PORT=3000
NODE_ENV=development

# Security
# Maximum upload size in bytes (500MB default)
MAX_UPLOAD_SIZE=524288000
```

**Git Ignore Configuration:**

```gitignore
# Environment files
.env
.env.local
.env.*.local

# Database files
*.db
*.sqlite
*.sqlite3

# Temporary files
/tmp
/temp
*.tmp

# Media files (should never be committed)
*.mp4
*.mov
*.avi
*.webm
```

### Temporary File Lifecycle Management

```typescript
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Service for managing temporary file lifecycle.
 * Ensures all temp files are cleaned up, even on crashes.
 */
@Injectable()
export class TempFileService implements OnModuleDestroy {
  private readonly logger = new Logger(TempFileService.name);
  private readonly TEMP_DIR = '/tmp/yts-processing';
  private readonly MAX_AGE_HOURS = 24; // Delete files older than 24h

  private activeTempFiles = new Set<string>();

  constructor() {
    this.initTempDirectory();
    this.scheduleCleanup();
  }

  /**
   * Initialize temp directory at startup.
   * Clean up any orphaned files from previous runs.
   */
  private async initTempDirectory() {
    try {
      await fs.mkdir(this.TEMP_DIR, { recursive: true });
      await this.cleanupOldFiles();
    } catch (error) {
      this.logger.error(`Temp directory init failed: ${error.message}`);
    }
  }

  /**
   * Create a tracked temp file.
   * File will be auto-cleaned on app shutdown.
   */
  async createTempFile(prefix: string, extension: string): Promise<string> {
    const filename = `${prefix}-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
    const filepath = path.join(this.TEMP_DIR, filename);
    
    this.activeTempFiles.add(filepath);
    this.logger.debug(`Created temp file: ${filepath}`);
    
    return filepath;
  }

  /**
   * Explicitly delete a temp file.
   */
  async deleteTempFile(filepath: string): Promise<void> {
    try {
      await fs.unlink(filepath);
      this.activeTempFiles.delete(filepath);
      this.logger.debug(`Deleted temp file: ${filepath}`);
    } catch (error) {
      this.logger.warn(`Failed to delete ${filepath}: ${error.message}`);
    }
  }

  /**
   * Cleanup old temp files (safety net for orphaned files).
   */
  private async cleanupOldFiles() {
    try {
      const files = await fs.readdir(this.TEMP_DIR);
      const now = Date.now();
      const maxAge = this.MAX_AGE_HOURS * 60 * 60 * 1000;

      for (const file of files) {
        const filepath = path.join(this.TEMP_DIR, file);
        const stats = await fs.stat(filepath);
        
        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filepath);
          this.logger.log(`Cleaned up old temp file: ${file}`);
        }
      }
    } catch (error) {
      this.logger.error(`Cleanup failed: ${error.message}`);
    }
  }

  /**
   * Schedule periodic cleanup (every 6 hours).
   */
  private scheduleCleanup() {
    setInterval(() => {
      this.cleanupOldFiles();
    }, 6 * 60 * 60 * 1000); // 6 hours
  }

  /**
   * Cleanup all active temp files on app shutdown.
   */
  async onModuleDestroy() {
    this.logger.log('Cleaning up temp files on shutdown...');
    
    const deletions = Array.from(this.activeTempFiles).map(filepath =>
      this.deleteTempFile(filepath)
    );

    await Promise.allSettled(deletions);
    this.logger.log(`Shutdown cleanup complete. Deleted ${deletions.length} files.`);
  }
}
```

### API Communication Security

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

/**
 * Secure HTTP client for external API calls.
 * Implements timeout, retry, and error handling.
 */
@Injectable()
export class SecureHttpService {
  private readonly logger = new Logger(SecureHttpService.name);
  private readonly TIMEOUT_MS = 30000; // 30 seconds

  constructor(private readonly httpService: HttpService) {}

  /**
   * Make a secure API request to Gemini.
   * Never logs sensitive data (API keys, video content).
   */
  async callGeminiAPI(payload: any, apiKey: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
          payload,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey, // Do NOT log this header
            },
            timeout: this.TIMEOUT_MS,
          }
        )
      );

      // Log success without sensitive data
      this.logger.log('Gemini API call successful');
      return response.data;

    } catch (error) {
      // Log error WITHOUT exposing API key or request payload
      this.logger.error(`Gemini API call failed: ${error.message}`);
      
      if (error.response) {
        this.logger.error(`Status: ${error.response.status}`);
        // Do NOT log error.response.config.headers (contains API key)
      }

      throw error;
    }
  }
}
```

## Common Pitfalls

### ❌ DON'T: Store video files permanently
```typescript
// BAD: Violates zero-persistence rule
await fs.copyFile(uploadPath, './storage/videos/video.mp4');
```

### ✅ DO: Process and delete immediately
```typescript
// GOOD: Process in temp, cleanup after
try {
  await processVideo(tempPath);
} finally {
  await fs.unlink(tempPath);
}
```

### ❌ DON'T: Hardcode secrets
```typescript
// BAD: API key in code
const apiKey = 'AIzaSyABC123...';
```

### ✅ DO: Load from environment
```typescript
// GOOD: Secure secrets management
const apiKey = this.configService.get('GEMINI_API_KEY');
```

### ❌ DON'T: Trust user filenames
```typescript
// BAD: Path traversal vulnerability
const savePath = `/tmp/${req.body.filename}`;
```

### ✅ DO: Sanitize and validate
```typescript
// GOOD: Generate secure filenames
const savePath = `/tmp/${crypto.randomBytes(16).toString('hex')}.mp4`;
```

### ❌ DON'T: Log sensitive data
```typescript
// BAD: API key in logs
this.logger.log(`Calling Gemini with key ${apiKey}`);
```

### ✅ DO: Log without secrets
```typescript
// GOOD: Logs action, not secrets
this.logger.log('Calling Gemini API');
```

## Data Retention Policy

### What is Persisted (SQLite)
- ✅ Project names and descriptions
- ✅ Segment timestamps (start/end times)
- ✅ Rendering job status
- ✅ AI analysis metadata (confidence scores, reasons)

### What is NOT Persisted
- ❌ Video file binary data
- ❌ Audio file binary data
- ❌ Extracted video frames
- ❌ Temporary processing files
- ❌ API request/response payloads

### User Data Deletion

```typescript
/**
 * Delete all user data for a project.
 * Complies with GDPR right to erasure.
 */
async deleteProject(projectId: string): Promise<void> {
  // Delete database records
  await this.projectRepository.delete(projectId);
  await this.segmentRepository.delete({ projectId });
  await this.jobRepository.delete({ projectId });

  // Verify no temp files remain
  const tempFiles = await this.findTempFiles(projectId);
  for (const file of tempFiles) {
    await fs.unlink(file);
  }

  this.logger.log(`Project ${projectId} fully deleted`);
}
```

## Security Checklist

Before deploying any feature:
- [ ] All file uploads validate MIME type and size
- [ ] Filenames are sanitized (no path traversal)
- [ ] Video files are deleted after processing (zero-persistence)
- [ ] API keys loaded from environment (never hardcoded)
- [ ] .env file in .gitignore
- [ ] Temp files cleaned up in try/finally blocks
- [ ] No sensitive data in logs (API keys, file content)
- [ ] Max file size enforced (500MB default)
- [ ] Temp directory has cleanup scheduled
- [ ] OnModuleDestroy implements cleanup

## Testing Security

### Unit Tests

```typescript
describe('File Upload Security', () => {
  it('should reject files larger than 500MB', async () => {
    const largeMockFile = { size: 600 * 1024 * 1024 } as Express.Multer.File;
    
    await expect(
      controller.uploadVideo(largeMockFile)
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('should reject non-video MIME types', async () => {
    const mockFile = { 
      mimetype: 'application/pdf',
      size: 1024 
    } as Express.Multer.File;
    
    await expect(
      controller.uploadVideo(mockFile)
    ).rejects.toThrow(BadRequestException);
  });

  it('should sanitize malicious filenames', () => {
    const malicious = '../../etc/passwd';
    const sanitized = sanitizeFilename(malicious);
    
    expect(sanitized).not.toContain('..');
    expect(sanitized).not.toContain('/');
  });
});
```

## Resources

- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
- [NestJS Security Best Practices](https://docs.nestjs.com/security/helmet)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Zero-Persistence)
