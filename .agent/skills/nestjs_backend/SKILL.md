---
name: NestJS Backend
description: Building scalable services and controllers with NestJS for the YouTube-Shorter-Gemini backend
---

# NestJS Custom Skill

## When to Use This Skill

Use this skill when working on ANY backend code in `apps/back/src/`. This includes:
- Creating modules, controllers, services
- Implementing TypeORM entities and repositories
- Setting up SSE (Server-Sent Events) endpoints
- Managing the SQL-Queue reactive job system
- Integrating with external APIs (Gemini, Ollama)
- Handling FFmpeg orchestration

## Core Principles

### 1. SOLID Architecture
- **Single Responsibility**: Each service handles ONE domain concern
- **Dependency Injection**: Use NestJS DI exclusively (no manual instantiation)
- **Class-based OOP**: Prefer classes over functions (project standard)
- **Interface Segregation**: Define minimal, focused interfaces

### 2. Domain-Driven Organization
```
apps/back/src/
├── modules/
│   ├── ingestion/           # Video upload & project creation
│   ├── analysis/            # Gemini AI integration
│   ├── processing/          # FFmpeg rendering & timing
│   └── projects/            # Project CRUD
├── entities/                # TypeORM entities (shared across modules)
├── workers/                 # Background job processors
├── common/                  # Shared utilities, decorators, filters
└── main.ts                  # Bootstrap application
```

### 3. TypeORM Data Mapper Pattern
- Use **Data Mapper** (not Active Record)
- Entities are plain classes with decorators
- Repositories handle all DB operations
- Keep business logic in services, NOT entities

## Mandatory Patterns & Rules

### Module Structure

Each module follows this structure:

```
modules/ingestion/
├── ingestion.module.ts           # Module definition
├── ingestion.controller.ts       # HTTP endpoints
├── ingestion.service.ts          # Business logic
├── ingestion.service.spec.ts     # Unit tests
├── dto/
│   ├── upload-video.dto.ts       # Request validation
│   └── video-response.dto.ts     # Response shape
└── interfaces/
    └── ingestion-options.interface.ts
```

### Controller Template

```typescript
import { Controller, Post, Body, UseInterceptors, UploadedFile, HttpStatus } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UploadVideoDto } from './dto/upload-video.dto';
import { VideoResponseDto } from './dto/video-response.dto';
import { IngestionService } from './ingestion.service';

/**
 * Handles video ingestion and project initialization.
 * All endpoints return the standard API envelope format.
 */
@ApiTags('ingestion')
@Controller('api/ingestion')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  /**
   * Upload a video file and create a new project.
   * 
   * @param file - The uploaded video file (multipart/form-data)
   * @param dto - Project metadata (name, description)
   * @returns API envelope with project details
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('video'))
  @ApiOperation({ summary: 'Upload video and create project' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Video uploaded successfully',
    type: VideoResponseDto 
  })
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVideoDto,
  ) {
    try {
      const project = await this.ingestionService.processVideoUpload(file, dto);
      
      // Standard API envelope (from architecture.md)
      return {
        success: true,
        data: project,
      };
    } catch (error) {
      // Let NestJS exception filters handle errors
      throw error;
    }
  }
}
```

### Service Template with Dependency Injection

```typescript
import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { VideoSegment } from '../../entities/video-segment.entity';
import { UploadVideoDto } from './dto/upload-video.dto';
import { FfmpegService } from '../processing/ffmpeg.service';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Service handling video ingestion logic.
 * Orchestrates file handling, metadata extraction, and DB persistence.
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    
    @InjectRepository(VideoSegment)
    private readonly segmentRepository: Repository<VideoSegment>,
    
    private readonly ffmpegService: FfmpegService,
  ) {}

  /**
   * Process uploaded video: save to temp, extract metadata, create project.
   * Follows zero-persistence rule: files cleaned up after processing.
   * 
   * @param file - Uploaded file buffer
   * @param dto - Project metadata
   * @returns Created project entity
   */
  async processVideoUpload(
    file: Express.Multer.File,
    dto: UploadVideoDto,
  ): Promise<Project> {
    this.logger.log(`Processing upload for project: ${dto.name}`);

    // Validate file
    if (!file || !file.buffer) {
      throw new BadRequestException('No video file provided');
    }

    const tempPath = path.join('/tmp', `upload-${Date.now()}.mp4`);

    try {
      // Save to temp location
      await fs.writeFile(tempPath, file.buffer);

      // Extract metadata using FFmpeg
      const metadata = await this.ffmpegService.extractMetadata(tempPath);

      // Create project entity
      const project = this.projectRepository.create({
        name: dto.name,
        description: dto.description,
        videoDuration: metadata.duration,
        videoResolution: `${metadata.width}x${metadata.height}`,
        createdAt: new Date().toISOString(), // ISO 8601 format
      });

      // Persist to SQLite
      const savedProject = await this.projectRepository.save(project);

      this.logger.log(`Project created with ID: ${savedProject.id}`);
      return savedProject;

    } finally {
      // Zero-persistence: always cleanup temp files
      await fs.unlink(tempPath).catch((err) => 
        this.logger.error(`Failed to cleanup temp file: ${err.message}`)
      );
    }
  }
}
```

### TypeORM Entity Template

```typescript
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { VideoSegment } from './video-segment.entity';

/**
 * Project entity representing a video editing project.
 * Uses Data Mapper pattern - business logic stays in services.
 */
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'video_duration', type: 'real' })
  videoDuration: number; // in seconds

  @Column({ name: 'video_resolution', type: 'varchar', length: 50 })
  videoResolution: string; // e.g., "1920x1080"

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: string; // ISO 8601 string

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt: string;

  // Relationships
  @OneToMany(() => VideoSegment, (segment) => segment.project, {
    cascade: true,
    eager: false, // Lazy load for performance
  })
  segments: VideoSegment[];

  // Note: NO business logic methods here (Data Mapper pattern)
}
```

### DTO with Validation

```typescript
import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for video upload requests.
 * Uses class-validator for automatic validation via ValidationPipe.
 */
export class UploadVideoDto {
  @ApiProperty({ 
    description: 'Project name', 
    example: 'My YouTube Short',
    maxLength: 255 
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ 
    description: 'Project description',
    example: 'A compilation of best moments' 
  })
  @IsString()
  @IsOptional()
  description?: string;
}
```

**Move DTOs to shared package when used by frontend:**
```typescript
// packages/shared/dto/upload-video.dto.ts
export class UploadVideoDto {
  name: string;
  description?: string;
}
```

### Server-Sent Events (SSE) Implementation

For real-time progress updates (FFmpeg rendering, AI analysis):

```typescript
import { Controller, Sse, Param, MessageEvent } from '@nestjs/common';
import { Observable, interval, map, takeWhile } from 'rxjs';
import { ProcessingService } from './processing.service';

@Controller('api/render')
export class RenderController {
  constructor(private readonly processingService: ProcessingService) {}

  /**
   * SSE endpoint for real-time rendering progress.
   * Client subscribes to receive progress updates.
   * 
   * @param jobId - The job ID to monitor
   * @returns Observable stream of progress events
   */
  @Sse('progress/:jobId')
  streamProgress(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return this.processingService.getJobProgress(jobId).pipe(
      map((progress) => ({
        data: {
          jobId,
          percentage: progress.percentage,
          status: progress.status,
          message: progress.message,
          timestamp: new Date().toISOString(),
        },
      })),
      takeWhile((event) => event.data.percentage < 100, true),
    );
  }
}
```

### SQL-Queue Reactive Pattern

**Job Entity:**
```typescript
@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  type: 'RENDER' | 'ANALYSIS' | 'EXTRACTION';

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  @Column({ type: 'text' })
  payload: string; // JSON stringified

  @Column({ type: 'integer', default: 0 })
  progress: number; // 0-100

  @Column({ name: 'created_at', type: 'datetime' })
  createdAt: string;

  @Column({ name: 'updated_at', type: 'datetime' })
  updatedAt: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;
}
```

**Job Service (Event-Driven Queue):**
```typescript
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from '../../entities/job.entity';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Subject, Observable } from 'rxjs';

@Injectable()
export class JobService implements OnModuleInit {
  private readonly logger = new Logger(JobService.name);
  private progressStreams = new Map<string, Subject<any>>();

  constructor(
    @InjectRepository(Job)
    private readonly jobRepository: Repository<Job>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * On startup, recover any stuck jobs.
   */
  async onModuleInit() {
    const stuckJobs = await this.jobRepository.find({
      where: { status: 'PROCESSING' },
    });

    for (const job of stuckJobs) {
      this.logger.warn(`Recovering stuck job: ${job.id}`);
      this.eventEmitter.emit('job.process', job);
    }
  }

  /**
   * Create a job and immediately trigger processing (reactive).
   */
  async createJob(type: Job['type'], payload: any): Promise<Job> {
    const job = this.jobRepository.create({
      type,
      status: 'PENDING',
      payload: JSON.stringify(payload),
      progress: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const savedJob = await this.jobRepository.save(job);
    
    // Immediately trigger processing (event-driven, no polling)
    this.eventEmitter.emit('job.process', savedJob);
    
    return savedJob;
  }

  /**
   * Update job progress and emit to SSE subscribers.
   */
  async updateProgress(jobId: string, progress: number, message?: string) {
    await this.jobRepository.update(jobId, {
      progress,
      updatedAt: new Date().toISOString(),
    });

    // Emit to SSE stream
    const stream = this.progressStreams.get(jobId);
    if (stream) {
      stream.next({ percentage: progress, message, status: 'PROCESSING' });
    }
  }

  /**
   * Get observable stream for SSE endpoint.
   */
  getJobProgress(jobId: string): Observable<any> {
    if (!this.progressStreams.has(jobId)) {
      this.progressStreams.set(jobId, new Subject());
    }
    return this.progressStreams.get(jobId)!.asObservable();
  }

  /**
   * Listen for job processing events.
   */
  @OnEvent('job.process')
  async handleJobProcess(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.type}`);
    
    // Update status to PROCESSING
    await this.jobRepository.update(job.id, { 
      status: 'PROCESSING',
      updatedAt: new Date().toISOString() 
    });

    // Delegate to appropriate processor based on type
    this.eventEmitter.emit(`job.process.${job.type.toLowerCase()}`, job);
  }
}
```

## Common Pitfalls

### ❌ DON'T: Use Active Record pattern
```typescript
// BAD: Mixing data and business logic
@Entity()
class Project extends BaseEntity {
  async processVideo() { /* business logic */ }
}
```

### ✅ DO: Use Data Mapper with services
```typescript
// GOOD: Entities are data, services have logic
@Injectable()
class ProjectService {
  async processVideo(projectId: string) { /* business logic */ }
}
```

### ❌ DON'T: Block the event loop
```typescript
// BAD: Synchronous CPU-intensive work
const result = execSync('ffmpeg ...');
```

### ✅ DO: Use async spawn for long tasks
```typescript
// GOOD: Non-blocking
const ffmpeg = spawn('ffmpeg', [...args]);
ffmpeg.stdout.on('data', (data) => { /* handle progress */ });
```

### ❌ DON'T: Hardcode configuration
```typescript
// BAD
const apiKey = 'AIzaSy...';
```

### ✅ DO: Use ConfigModule
```typescript
// GOOD
@Injectable()
class GeminiService {
  constructor(private configService: ConfigService) {}
  
  getApiKey() {
    return this.configService.get<string>('GEMINI_API_KEY');
  }
}
```

## Testing Requirements

### Unit Tests (Jest)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IngestionService } from './ingestion.service';
import { Project } from '../../entities/project.entity';
import { Repository } from 'typeorm';

describe('IngestionService', () => {
  let service: IngestionService;
  let projectRepo: Repository<Project>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: getRepositoryToken(Project),
          useClass: Repository, // Mock repository
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
    projectRepo = module.get<Repository<Project>>(getRepositoryToken(Project));
  });

  it('should create a project with valid metadata', async () => {
    const mockFile = {
      buffer: Buffer.from('fake video data'),
      originalname: 'test.mp4',
    } as Express.Multer.File;

    const dto = { name: 'Test Project', description: 'Test' };

    jest.spyOn(projectRepo, 'create').mockReturnValue({} as Project);
    jest.spyOn(projectRepo, 'save').mockResolvedValue({ id: '123' } as Project);

    const result = await service.processVideoUpload(mockFile, dto);

    expect(result.id).toBe('123');
    expect(projectRepo.save).toHaveBeenCalled();
  });
});
```

## Exception Handling

Use NestJS built-in exceptions:

```typescript
import { 
  BadRequestException, 
  NotFoundException, 
  InternalServerErrorException 
} from '@nestjs/common';

async findProject(id: string): Promise<Project> {
  const project = await this.projectRepository.findOne({ where: { id } });
  
  if (!project) {
    throw new NotFoundException(`Project with ID ${id} not found`);
  }
  
  return project;
}
```

## Checklist for Every Module

- [ ] Module has clear domain responsibility
- [ ] Services use dependency injection (no `new` keyword)
- [ ] DTOs use class-validator decorators
- [ ] Entities use Data Mapper pattern (no business logic)
- [ ] Controllers return API envelope: `{ success, data, error? }`
- [ ] All dates are ISO 8601 strings
- [ ] Long-running tasks use SQL-Queue reactive pattern
- [ ] JSDoc on all public methods
- [ ] Unit tests cover services (>80% coverage target)
- [ ] Exception handling uses NestJS exceptions

## Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Data Mapper](https://typeorm.io/active-record-data-mapper)
- Project Architecture: `_bmad-output/planning-artifacts/architecture.md`
