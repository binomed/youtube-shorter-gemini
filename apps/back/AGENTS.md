# ⚙️ Backend Domain Rules

These instructions apply to modifications within `apps/back/`.

## 🛠️ Tech Stack & Environment
- **Framework**: NestJS (TypeORM, Swagger, Config)
- **Database**: SQLite
- **Job Queues**: SQL-Queue reactive pattern (BullMQ/Redis alternative)
- **Media Processing**: FFmpeg, FFprobe, and Python-based Demucs.
- **AI Integration**: Google Gemini API (`@google/genai`).

## 📜 Critical Rules
1. **Architecture Restrictions**: 
   - Maintain strict separation of concerns using NestJS Modules, Controllers, Services, and Repositories.
   - Do not handle heavy business logic inside controllers.
2. **Media Processing Constraints (Zero-Persistence)**:
   - Videos and media assets are highly sensitive.
   - All media files MUST be cleaned up immediately upon job completion or failure.
   - Do not store persistent user media files without explicit architecture.
3. **Heavy Operations & Long Polling**:
   - Video processing (FFmpeg) and AI analysis (Gemini) are slow operations.
   - DO NOT block the main HTTP thread. Use asynchronous queue workers (`apps/back/src/workers/`).
   - Understand the SSE (Server-Sent Events) architecture used to push job progress back to the frontend.

## 📚 Required Context
Before generating code, reference the deep skills in `.agents/skills/`:
- `nestjs_backend/SKILL.md`
- `ffmpeg_media_processing/SKILL.md`
- `gemini_ai_integration/SKILL.md`
- `sse_realtime_communication/SKILL.md`
- `typeorm_sqlite_data_layer/SKILL.md`

## ✅ Pre-Commit Verification
Within this context, ensure you can successfully run:
```bash
npm run lint --workspace=back
npm run test:cov --workspace=back
```
