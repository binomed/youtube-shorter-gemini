---
name: SSE Real-time Communication
description: Patterns and rules for reactive communication between NestJS (backend) and Lit (frontend) using Server-Sent Events (SSE).
trigger: glob
globs:
  - "apps/back/src/modules/processing/**"
  - "apps/front/src/services/**"
  - "packages/shared/src/types/*.ts"
---

# 📡 SSE Real-time Communication Skill

## Overview
This project relies heavily on **Server-Sent Events (SSE)** to provide real-time progression for long-running jobs (video analysis, audio separation, and export).

## 🏗️ Backend Pattern (NestJS)

### 1. Unified Progress Service
All progress updates MUST go through the `JobProgressService` in `apps/back/src/modules/processing/job-progress.service.ts`. 

- **Subject Management**: Uses `ReplaySubject(1)` to ensure the latest status is immediately available to new subscribers.
- **Persistence**: Automatically updates the `Job` entity in SQLite via `JobService`.
- **Cleanup**: Streams are automatically completed and removed from memory after a terminal state (`complete`, `error`, or `progress >= 100`).

### 2. SSE Controller Endpoint
Use the `@Sse()` decorator. Return an `Observable` from `JobProgressService`.

```typescript
@Sse(':jobId/progress')
getSnapshotProgress(@Param('jobId') jobId: string): Observable<MessageEvent> {
  return this.jobProgressService.getStream(jobId).pipe(
    map((data) => ({ data } as MessageEvent)),
  );
}
```

---

## 💻 Frontend Pattern (Lit)

### 1. EventSource Lifecycle
Manage the `EventSource` connection within the component lifecycle or a dedicated service.

- **Connection**: `new EventSource('/api/processing/{jobId}/progress')`.
- **Cleanup**: Always call `eventSource.close()` in `disconnectedCallback()` or when the job finishes to avoid memory leaks.

### 2. State Integration
Pipe SSE data directly into **Lit Signals** for reactive UI updates.

```typescript
eventSource.onmessage = (e) => {
  const data = JSON.parse(e.data);
  jobState.value = { ...jobState.value, ...data };
};
```

---

## 🧩 Shared Types
SSE events MUST be typed in `packages/shared/src/types/`.

- `AnalysisProgressEvent`
- `StemProgressEvent`
- `ExportProgressEvent`

Each event MUST follow this structure:
```typescript
export interface BaseProgressEvent {
  phase: string;
  progress: number; // 0 to 100
  message: string;
}
```

## 📝 Rules
1. **Never block the HTTP thread**: SSE handlers must be reactive (RxJS).
2. **Standard phases**: Use the phases defined in the shared types (e.g., `extracting_frames`, `transcribing`).
3. **Flushing**: The backend adds a 1000ms delay before closing the stream to ensure the final "complete" message reaches the client.
