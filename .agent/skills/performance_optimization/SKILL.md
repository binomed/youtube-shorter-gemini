---
name: Performance Optimization
description: Profiling, SSE efficiency, and application performance optimization for the YouTube-Shorter-Gemini project
---

# Performance Custom Skill

## When to Use This Skill

Use this skill when working on ANY performance-critical code. This includes:
- SSE (Server-Sent Events) implementations
- FFmpeg rendering operations
- Large file processing
- Frontend component rendering
- Database queries
- API response times

## Core Principles

### 1. Performance Targets (from Architecture)
- **Render time**: < 60s for a 60s video segment
- **Metadata extraction**: < 2s
- **SSE latency**: Real-time (<100ms for progress updates)
- **UI responsiveness**: 60 FPS, no blocking operations
- **API response**: < 500ms for non-processing endpoints

### 2. Measurement-Driven Optimization
- **Profile before optimizing** - measure actual bottlenecks
- Use Chrome DevTools, Node.js profiler
- Monitor real-world metrics, not synthetic benchmarks
- Optimize the critical path first

### 3. Async & Non-Blocking
- Never block the event loop
- Use Web Workers for CPU-intensive frontend tasks
- Spawn child processes for backend heavy operations
- Stream large responses instead of buffering

## Mandatory Patterns & Rules

### SSE Performance Optimization

**Efficient SSE Implementation:**

```typescript
import { Controller, Sse, Param, MessageEvent } from '@nestjs/common';
import { Observable, interval, map, takeWhile, share } from 'rxjs';
import { JobService } from './job.service';

@Controller('api/jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  /**
   * Optimized SSE endpoint for job progress.
   * Uses RxJS operators for efficient streaming.
   * 
   * Performance improvements:
   * - share() prevents duplicate subscriptions
   * - takeWhile() auto-completes at 100%
   * - Minimal DB queries (event-driven updates)
   */
  @Sse('progress/:jobId')
  streamProgress(@Param('jobId') jobId: string): Observable<MessageEvent> {
    return this.jobService.getJobProgress(jobId).pipe(
      map((progress) => ({
        data: {
          jobId,
          percentage: progress.percentage,
          message: progress.message,
          timestamp: Date.now(), // Use timestamp instead of ISO string for speed
        },
      })),
      takeWhile((event) => event.data.percentage < 100, true),
      share(), // Share subscription to prevent duplicate processing
    );
  }
}
```

**SSE Client-Side Optimization:**

```typescript
import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';

/**
 * Efficient SSE consumer for progress updates.
 * Throttles UI updates to avoid excessive re-renders.
 */
@customElement('yts-progress-monitor')
export class YtsProgressMonitor extends LitElement {
  @state()
  private progress = 0;

  @state()
  private message = '';

  private eventSource?: EventSource;
  private lastUpdateTime = 0;
  private UPDATE_THROTTLE_MS = 100; // Max 10 updates/second

  connectedCallback() {
    super.connectedCallback();
    this.initSSE();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.eventSource?.close();
  }

  private initSSE() {
    this.eventSource = new EventSource(`/api/jobs/progress/${this.jobId}`);

    this.eventSource.addEventListener('message', (e) => {
      const now = Date.now();
      
      // Throttle UI updates to improve performance
      if (now - this.lastUpdateTime < this.UPDATE_THROTTLE_MS) {
        return;
      }

      this.lastUpdateTime = now;
      const data = JSON.parse(e.data);
      
      this.progress = data.percentage;
      this.message = data.message;

      // Auto-close at completion
      if (this.progress >= 100) {
        this.eventSource?.close();
      }
    });

    this.eventSource.onerror = () => {
      console.error('SSE connection error');
      this.eventSource?.close();
    };
  }

  render() {
    return html`
      <div class="progress">
        <progress value=${this.progress} max="100"></progress>
        <span>${this.progress}%</span>
        <p>${this.message}</p>
      </div>
    `;
  }
}
```

### Database Query Optimization

**Efficient TypeORM Queries:**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from '../../entities/project.entity';

@Injectable()
export class ProjectService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  /**
   * Optimized project retrieval with selective relations.
   * 
   * Performance tips:
   * - Use select() to fetch only needed columns
   * - Eager load relations with leftJoinAndSelect() to avoid N+1 queries
   * - Use pagination for large result sets
   */
  async findProjectWithSegments(projectId: string): Promise<Project> {
    return this.projectRepository
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.segments', 'segment')
      .select([
        'project.id',
        'project.name',
        'project.createdAt',
        'segment.id',
        'segment.startTime',
        'segment.endTime',
      ])
      .where('project.id = :projectId', { projectId })
      .getOne();
  }

  /**
   * Paginated project list for performance.
   */
  async findAllPaginated(page: number = 1, limit: number = 20) {
    const [projects, total] = await this.projectRepository.findAndCount({
      select: ['id', 'name', 'createdAt'], // Only needed fields
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      projects,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Bulk operations for efficiency.
   */
  async deleteOldProjects(daysOld: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.projectRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { 
        cutoffDate: cutoffDate.toISOString() 
      })
      .execute();

    return result.affected || 0;
  }
}
```

### Frontend Performance Patterns

**Lit Component Optimization:**

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';

/**
 * Optimized list component for large datasets.
 * Uses repeat() directive for efficient DOM updates.
 */
@customElement('yts-segment-list')
export class YtsSegmentList extends LitElement {
  @property({ type: Array })
  segments: VideoSegment[] = [];

  static styles = css`
    :host {
      display: block;
      contain: layout style; /* CSS containment for performance */
    }

    .segment-item {
      will-change: transform; /* Hint for GPU acceleration */
    }
  `;

  /**
   * Use repeat() for efficient list rendering.
   * Only updates changed items, not entire list.
   */
  render() {
    return html`
      <div class="segment-list">
        ${repeat(
          this.segments,
          (segment) => segment.id, // Key function
          (segment) => html`
            <yts-segment-item
              .segment=${segment}
              @toggle=${() => this.toggleSegment(segment.id)}
            ></yts-segment-item>
          `
        )}
      </div>
    `;
  }

  /**
   * Debounce rapid updates to avoid excessive re-renders.
   */
  private toggleDebounceTimer?: number;

  private toggleSegment(id: string) {
    clearTimeout(this.toggleDebounceTimer);
    
    this.toggleDebounceTimer = setTimeout(() => {
      // Actual toggle logic
      this.dispatchEvent(new CustomEvent('segment-toggle', {
        detail: { id },
        bubbles: true,
      }));
    }, 50);
  }
}
```

**Lazy Loading Heavy Components:**

```typescript
/**
 * Lazy load video editor component (large dependency).
 */
@customElement('yts-app')
export class YtsApp extends LitElement {
  @state()
  private showEditor = false;

  private async loadEditor() {
    // Dynamic import - only load when needed
    await import('./components/organisms/yts-video-editor.element.js');
    this.showEditor = true;
  }

  render() {
    return html`
      <button @click=${this.loadEditor}>Open Editor</button>
      
      ${this.showEditor
        ? html`<yts-video-editor></yts-video-editor>`
        : ''
      }
    `;
  }
}
```

### File Processing Performance

**Stream Large Files:**

```typescript
import { Injectable, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';

@Injectable()
export class RenderService {
  /**
   * Stream rendered video instead of buffering entire file.
   * Reduces memory usage and improves time-to-first-byte.
   */
  async streamRenderedVideo(filepath: string): Promise<StreamableFile> {
    const stats = await stat(filepath);
    const stream = createReadStream(filepath);

    return new StreamableFile(stream, {
      type: 'video/mp4',
      length: stats.size,
      disposition: `attachment; filename="render.mp4"`,
    });
  }
}
```

**Chunked Upload Processing:**

```typescript
/**
 * Process uploaded video in chunks to limit memory usage.
 */
async processLargeUpload(filepath: string): Promise<void> {
  const stream = createReadStream(filepath, {
    highWaterMark: 1024 * 1024, // 1MB chunks
  });

  for await (const chunk of stream) {
    // Process chunk without loading entire file
    await this.analyzeChunk(chunk);
  }
}
```

## Profiling & Monitoring

### Backend Profiling

```typescript
import { Injectable, Logger } from '@nestjs/common';

/**
 * Performance monitoring decorator.
 */
export function Profile(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  const logger = new Logger(target.constructor.name);

  descriptor.value = async function (...args: any[]) {
    const start = performance.now();
    
    try {
      const result = await originalMethod.apply(this, args);
      const duration = performance.now() - start;
      
      if (duration > 1000) {
        logger.warn(`${propertyKey} took ${duration.toFixed(2)}ms`);
      } else {
        logger.debug(`${propertyKey} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error(`${propertyKey} failed after ${duration.toFixed(2)}ms`);
      throw error;
    }
  };

  return descriptor;
}

// Usage
@Injectable()
export class FfmpegService {
  @Profile
  async extractMetadata(videoPath: string) {
    // Method automatically profiled
  }
}
```

### Frontend Performance Monitoring

```typescript
/**
 * Measure component render performance.
 */
@customElement('yts-video-editor')
export class YtsVideoEditor extends LitElement {
  protected updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);

    if (import.meta.env.DEV) {
      performance.mark('render-end');
      performance.measure('render', 'render-start', 'render-end');
      
      const measure = performance.getEntriesByName('render')[0];
      console.log(`Render time: ${measure.duration.toFixed(2)}ms`);
    }
  }

  protected willUpdate() {
    if (import.meta.env.DEV) {
      performance.mark('render-start');
    }
  }
}
```

## Common Pitfalls

### ❌ DON'T: Block event loop with sync operations
```typescript
// BAD: Blocks for 5 seconds
const result = execSync('ffmpeg -i video.mp4');
```

### ✅ DO: Use async operations
```typescript
// GOOD: Non-blocking
const result = await this.ffmpegService.processVideo('video.mp4');
```

### ❌ DON'T: Load all data at once
```typescript
// BAD: Loads entire database into memory
const allProjects = await projectRepo.find();
```

### ✅ DO: Use pagination
```typescript
// GOOD: Loads 20 at a time
const projects = await projectRepo.find({ take: 20, skip: 0 });
```

### ❌ DON'T: Re-render entire list on change
```typescript
// BAD: Re-renders all 1000 items
this.segments = [...this.segments, newSegment];
```

### ✅ DO: Use efficient list directives
```typescript
// GOOD: Only renders new item
${repeat(segments, s => s.id, s => html`...`)}
```

## Performance Checklist

- [ ] DB queries use select() for needed columns only
- [ ] Relations eager loaded to avoid N+1 queries
- [ ] Large lists use pagination
- [ ] SSE updates throttled (<100ms intervals)
- [ ] Heavy components lazy loaded
- [ ] Files streamed, not buffered
- [ ] Event loop never blocked (no execSync)
- [ ] CSS containment used on large lists
- [ ] repeat() directive for dynamic lists
- [ ] Performance profiled in dev tools

## Resources

- [Lit Performance Best Practices](https://lit.dev/docs/components/performance/)
- [Node.js Performance](https://nodejs.org/en/docs/guides/simple-profiling/)
- [TypeORM Query Optimization](https://typeorm.io/select-query-builder)
- [Chrome DevTools Performance](https://developer.chrome.com/docs/devtools/performance/)
- Architecture: `_bmad-output/planning-artifacts/architecture.md` (Performance Targets)
