---
name: Testing Strategy
description: Unit, integration, and E2E testing patterns using Vitest, Jest, and Playwright for the YouTube-Shorter-Gemini project
---

# Testing Custom Skill

## When to Use This Skill

Use this skill when writing ANY test code in the project. This includes:
- Unit tests for services, controllers, components (co-located `*.spec.ts`)
- Integration tests for API endpoints and database operations
- E2E tests for complete user workflows (Playwright)
- Testing FFmpeg integrations and async job processing

## Core Principles

### 1. Test Coverage Standards
- **Target**: >80% coverage for services and business logic
- **Minimum**: 100% coverage for security-critical code (file uploads, secrets)
- **Focus**: Test behavior, not implementation details
- **Co-location**: Tests next to source files (`*.spec.ts`)

### 2. Test Pyramid
- **Unit Tests (70%)**: Fast, isolated, test single functions/classes
- **Integration Tests (20%)**: Test module interactions, DB operations
- **E2E Tests (10%)**: Test complete user workflows through UI

### 3. AAA Pattern (Arrange-Act-Assert)
- **Arrange**: Set up test data and mocks
- **Act**: Execute the function/method under test
- **Assert**: Verify expected outcomes

## Mandatory Patterns & Rules

### Frontend Testing (Vitest + @open-wc/testing)

**File**: `apps/front/src/components/atoms/yts-button.element.spec.ts`

```typescript
import { fixture, html, expect } from '@open-wc/testing';
import { YtsButton } from './yts-button.element';
import './yts-button.element'; // Register custom element

describe('YtsButton Tests', () => {
  describe('Rendering', () => {
    it('should render with default properties', async () => {
      const el = await fixture<YtsButton>(html`
        <yts-button>Click me</yts-button>
      `);

      expect(el.disabled).to.be.false;
      expect(el.variant).to.equal('primary');
      
      const button = el.shadowRoot!.querySelector('button');
      expect(button).to.exist;
      expect(button!.textContent!.trim()).to.equal('Click me');
    });

    it('should reflect disabled attribute', async () => {
      const el = await fixture<YtsButton>(html`
        <yts-button disabled>Disabled</yts-button>
      `);

      expect(el.disabled).to.be.true;
      expect(el.hasAttribute('disabled')).to.be.true;
    });
  });

  describe('Events', () => {
    it('should dispatch yts-click event on click', async () => {
      const el = await fixture<YtsButton>(html`
        <yts-button>Click</yts-button>
      `);

      let eventFired = false;
      let eventDetail: any;

      el.addEventListener('yts-click', (e: Event) => {
        eventFired = true;
        eventDetail = (e as CustomEvent).detail;
      });

      const button = el.shadowRoot!.querySelector('button')!;
      button.click();

      expect(eventFired).to.be.true;
      expect(eventDetail).to.have.property('timestamp');
    });

    it('should NOT dispatch event when disabled', async () => {
      const el = await fixture<YtsButton>(html`
        <yts-button disabled>Click</yts-button>
      `);

      let eventFired = false;
      el.addEventListener('yts-click', () => { eventFired = true; });

      const button = el.shadowRoot!.querySelector('button')!;
      button.click();

      expect(eventFired).to.be.false;
    });
  });

  describe('Accessibility', () => {
    it('should be accessible', async () => {
      const el = await fixture<YtsButton>(html`
        <yts-button>Accessible Button</yts-button>
      `);

      await expect(el).to.be.accessible();
    });

    it('should have aria-busy when loading', async () => {
      const el = await fixture<YtsButton>(html`
        <yts-button>Loading</yts-button>
      `);

      el.simulateLoading(5000);
      await el.updateComplete;

      const button = el.shadowRoot!.querySelector('button')!;
      expect(button.getAttribute('aria-busy')).to.equal('true');
    });
  });
});
```

**Vitest Config** (`apps/front/vitest.config.ts`):

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        '**/*.spec.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

### Backend Testing (Jest + NestJS)

**File**: `apps/back/src/modules/ingestion/ingestion.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IngestionService } from './ingestion.service';
import { Project } from '../../entities/project.entity';
import { FfmpegService } from '../processing/ffmpeg.service';

describe('IngestionService', () => {
  let service: IngestionService;
  let projectRepo: jest.Mocked<Repository<Project>>;
  let ffmpegService: jest.Mocked<FfmpegService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestionService,
        {
          provide: getRepositoryToken(Project),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: FfmpegService,
          useValue: {
            extractMetadata: jest.fn(),
            extractAudio: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<IngestionService>(IngestionService);
    projectRepo = module.get(getRepositoryToken(Project));
    ffmpegService = module.get(FfmpegService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processVideoUpload', () => {
    it('should create project with extracted metadata', async () => {
      // Arrange
      const mockFile = {
        buffer: Buffer.from('fake video data'),
        originalname: 'test.mp4',
        mimetype: 'video/mp4',
      } as Express.Multer.File;

      const mockMetadata = {
        duration: 120,
        width: 1920,
        height: 1080,
        framerate: 30,
        codec: 'h264',
      };

      const mockProject = {
        id: 'project-123',
        name: 'Test Project',
        videoDuration: 120,
      } as Project;

      ffmpegService.extractMetadata.mockResolvedValue(mockMetadata);
      projectRepo.create.mockReturnValue(mockProject);
      projectRepo.save.mockResolvedValue(mockProject);

      // Act
      const result = await service.processVideoUpload(mockFile, {
        name: 'Test Project',
        description: 'Test description',
      });

      // Assert
      expect(result.id).toBe('project-123');
      expect(ffmpegService.extractMetadata).toHaveBeenCalledTimes(1);
      expect(projectRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Project',
          videoDuration: 120,
        })
      );
    });

    it('should throw error for missing file', async () => {
      await expect(
        service.processVideoUpload(null as any, { name: 'Test' })
      ).rejects.toThrow('No video file provided');
    });

    it('should cleanup temp files even on error', async () => {
      const mockFile = {
        buffer: Buffer.from('data'),
        originalname: 'test.mp4',
      } as Express.Multer.File;

      ffmpegService.extractMetadata.mockRejectedValue(
        new Error('FFmpeg failed')
      );

      // Spy on cleanup
      const unlinkSpy = jest.spyOn(require('fs/promises'), 'unlink');

      await expect(
        service.processVideoUpload(mockFile, { name: 'Test' })
      ).rejects.toThrow();

      // Verify cleanup was attempted
      expect(unlinkSpy).toHaveBeenCalled();
    });
  });
});
```

**Jest Config** (`apps/back/jest.config.js`):

```javascript
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.interface.ts',
    '!**/index.ts',
  ],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  coverageThreshold: {
    global: {
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80,
    },
  },
};
```

### Integration Tests (Database + API)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IngestionModule } from './ingestion.module';

describe('Ingestion Controller (Integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:', // In-memory DB for tests
          entities: [__dirname + '/../../entities/*.entity{.ts,.js}'],
          synchronize: true,
        }),
        IngestionModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/ingestion/upload (POST) - should upload video', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/ingestion/upload')
      .field('name', 'Test Project')
      .field('description', 'Integration test')
      .attach('video', Buffer.from('fake video data'), 'test.mp4')
      .expect(201);

    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('id');
    expect(response.body.data.name).toBe('Test Project');
  });

  it('/api/ingestion/upload (POST) - should reject large files', async () => {
    const largeBuffer = Buffer.alloc(600 * 1024 * 1024); // 600MB

    await request(app.getHttpServer())
      .post('/api/ingestion/upload')
      .field('name', 'Large File')
      .attach('video', largeBuffer, 'large.mp4')
      .expect(413); // Payload Too Large
  });
});
```

### E2E Tests (Playwright)

**File**: `apps/front/e2e/upload-workflow.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import * as path from 'path';

test.describe('Video Upload Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173');
  });

  test('should upload video and create project', async ({ page }) => {
    // Navigate to upload page
    await page.click('text=New Project');

    // Fill project details
    await page.fill('input[name="projectName"]', 'E2E Test Project');
    await page.fill('textarea[name="description"]', 'End-to-end test');

    // Upload video file
    const videoPath = path.join(__dirname, 'fixtures', 'sample-video.mp4');
    await page.setInputFiles('input[type="file"]', videoPath);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for upload to complete
    await expect(page.locator('.upload-success')).toBeVisible({ timeout: 30000 });

    // Verify project appears in list
    await expect(page.locator('text=E2E Test Project')).toBeVisible();
  });

  test('should show error for invalid file type', async ({ page }) => {
    await page.click('text=New Project');
    await page.fill('input[name="projectName"]', 'Invalid File');

    const textFile = path.join(__dirname, 'fixtures', 'sample.txt');
    await page.setInputFiles('input[type="file"]', textFile);

    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toContainText('Invalid file type');
  });

  test('should display upload progress', async ({ page }) => {
    await page.click('text=New Project');
    await page.fill('input[name="projectName"]', 'Progress Test');

    const videoPath = path.join(__dirname, 'fixtures', 'large-video.mp4');
    await page.setInputFiles('input[type="file"]', videoPath);

    await page.click('button[type="submit"]');

    // Verify progress bar appears
    await expect(page.locator('yts-progress-bar')).toBeVisible();
    
    // Verify progress updates
    await expect(page.locator('.progress-percentage')).toContainText('%');
  });
});
```

**Playwright Config** (`apps/front/playwright.config.ts`):

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

## Testing Async Operations (Jobs, SSE)

```typescript
describe('RenderProcessor', () => {
  it('should update job progress during rendering', async () => {
    const mockJob = {
      id: 'job-123',
      type: 'RENDER',
      payload: JSON.stringify({
        segmentPaths: ['/tmp/seg1.mp4', '/tmp/seg2.mp4'],
        outputPath: '/tmp/output.mp4',
      }),
    } as Job;

    const progressUpdates: number[] = [];

    jest.spyOn(jobService, 'updateProgress').mockImplementation(async (id, progress) => {
      progressUpdates.push(progress);
    });

    await renderProcessor.handleRenderJob(mockJob);

    // Verify progress was updated multiple times
    expect(progressUpdates.length).toBeGreaterThan(1);
    expect(progressUpdates[progressUpdates.length - 1]).toBe(100);
  });
});
```

## Common Pitfalls

### ❌ DON'T: Test implementation details
```typescript
// BAD: Testing internal state
expect(component['_privateVariable']).toBe(5);
```

### ✅ DO: Test behavior
```typescript
// GOOD: Test observable behavior
expect(component.publicProperty).toBe(5);
```

### ❌ DON'T: Use real external services in unit tests
```typescript
// BAD: Calls real Gemini API
await geminiService.detectShortsCandidates(frames);
```

### ✅ DO: Mock external dependencies
```typescript
// GOOD: Mocked API
jest.spyOn(geminiService, 'detectShortsCandidates').mockResolvedValue([...]);
```

## Test Checklist

- [ ] Unit tests for all services (>80% coverage)
- [ ] Component tests include accessibility checks
- [ ] Integration tests use in-memory SQLite
- [ ] E2E tests cover critical user workflows
- [ ] Mocks used for external APIs (Gemini, Ollama)
- [ ] Temp file cleanup verified in tests
- [ ] Error cases tested (not just happy path)
- [ ] Async operations properly awaited
- [ ] Tests run in CI pipeline

## Running Tests

```bash
# Frontend unit tests
cd apps/front
npm run test

# Backend unit tests
cd apps/back
npm run test

# E2E tests
cd apps/front
npm run test:e2e

# Coverage reports
npm run test:cov
```

## Resources

- [Vitest Documentation](https://vitest.dev)
- [Open WC Testing](https://open-wc.org/docs/testing/testing-package/)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
- [Playwright Documentation](https://playwright.dev)
