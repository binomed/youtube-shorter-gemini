# Story 2.1: automated-viral-analysis

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a creator,
I want the AI to analyze my video and suggest 3-5 segments with high potential,
So that I don't waste time searching for key moments manually.

## Acceptance Criteria

1. **Given** an uploaded video **When** I trigger the "Analyze" action **Then** the system sends the video to Gemini API (multimodal).
2. The system analyzes the video for viral potential (humor, action, emotion, clarity).
3. The system returns a structured list of 3-5 suggested segments.
4. Each segment includes:
    - Title/Hook
    - Description
    - Start Timestamp (precise)
    - End Timestamp (precise)
    - Viral Score (optional/internal)
5. The segments are saved to the database associated with the project.
6. The UI displays these segments as cards in the "Source Segments" sidebar.
7. Clicking a segment card seeks the video player to the start timestamp.
8. Error handling: If Gemini fails (API limit, network), show a user-friendly error and offer manual creation.
9. Loading state: Show a progress indicator or "Analyzing..." state during the process (can take 30s+).

## Tasks / Subtasks

- [ ] Backend: Gemini Integration Service
  - [ ] Create `GeminiService` in `apps/back/src/modules/ai/`
  - [ ] Implement `analyzeVideo(videoPath: string)` using Vertex AI / Gemini API
  - [ ] Define Prompt Engineering for viral segment extractions
  - [ ] Parse JSON response from Gemini
  - [ ] Handle API errors and retries

- [ ] Backend: Analysis Endpoints
  - [ ] Create `AnalysisController` (POST `/api/projects/:id/analyze`)
  - [ ] Store results in `Segment` entity (Create `Segment` entity)
  - [ ] Return segments to frontend

- [ ] Backend: Data Model
  - [ ] Create `Segment` entity in `apps/back/src/entities/segment.entity.ts`
  - [ ] Fields: id, projectId, title, description, startTime, endTime, viralScore

- [ ] Frontend: Analysis Trigger & Display
  - [ ] Add "Analyze with AI" button in Dashboard/Editor
  - [ ] Connect "Source Segments" sidebar to real data
  - [ ] Implement loading state (skeleton or spinner)
  - [ ] Display Segment Cards with data
  - [ ] Implement seek-on-click

- [ ] Shared: DTOs
  - [ ] `CreateSegmentDto`
  - [ ] `SegmentResponseDto`

- [ ] Integration Testing
  - [ ] Mock Gemini API for backend tests
  - [ ] Test flow: Analyze -> Save -> Fetch

## Tech Stack
- Backend: NestJS, Vertex AI SDK / Google AI Studio SDK
- Database: SQLite (TypeORM)
- Frontend: Lit, Shoelace
