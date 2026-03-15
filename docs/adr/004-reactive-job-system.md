# ADR 004: Reactive Job System with SQL-Queue

**Date:** 2026-02-24
**Status:** Accepted
**Context:** Story 3.1.5 - Architectural Consolidation

---

## Context

The project uses heavy asynchronous processing for certain features:
- **AI Analysis**: FFmpeg frame extraction + Gemini API call (20-120 seconds)
- **Audio Stem Separation**: FFmpeg audio extraction + Demucs ML processing (30-180 seconds)

Before this ADR, these tasks were managed by `Subject<T>` and `Map<string, Subject>` stored in-memory in NestJS controllers. This approach presented several issues:

1. **Data Loss**: If the NestJS server restarts during processing, progress is lost and the client can no longer track the state.
2. **Scalability**: Impossible to query the state of a job from multiple instances or after SSE reconnection.
3. **Observability**: No persistent traceability of errors or processing history.

---

## Options Considered

1. **Redis + Bull/BullMQ**: Queue with Redis. Powerful and scalable. Too heavy for local desktop use without an external Redis server.
2. **In-memory Subject (existing)**: Simple but with no persistence. Rejected due to the issues listed above.
3. **SQL-Queue Pattern (SQLite)**: `Job` entity persisted in the existing SQLite database. Lightweight, no external dependency, perfectly suited for local use.

---

## Decision

We adopt the **SQL-Queue pattern**: a `Job` entity is created in the SQLite database (via TypeORM) at the start of each asynchronous processing task. Progress is updated regularly in this entity.

### Job Entity

```typescript
@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() type: 'stem_separation' | 'analysis';
  @Column() status: 'pending' | 'running' | 'completed' | 'failed';
  @Column() projectId: string;
  @Column({ nullable: true }) shortId?: string;
  @Column({ type: 'float', default: 0 }) progress: number;
  @Column({ nullable: true }) error?: string;
  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

### SSE Stream

The SSE endpoint (`/stems/progress`, `/analyze/progress`) queries the DB using polling every 500ms via an RxJS `interval` and emits events to the client.

---

## Consequences

### Positive
- ✅ **Resilience**: Job state survives server restarts.
- ✅ **History**: Past jobs can be queried for debugging.
- ✅ **Testability**: `JobService` can be easily mocked in unit tests.
- ✅ **No external dependency**: SQLite is already used in the project.

### Negative
- ⚠️ **DB Polling**: Polling every 500ms on the local SQLite DB is acceptable for desktop use, but would not be viable for high concurrency.
- ⚠️ **Cleanup**: Periodic purging of completed jobs must be planned (e.g., `CleanupService`).

---

## References

- [Workers & Job Queues Skill](.agent/skills/workers_job_queues/SKILL.md)
- [Story 3.1.5](_bmad-output/implementation-artifacts/3-1-5-consolidation-architecturale.md)
- [Architecture](_bmad-output/planning-artifacts/architecture.md)
