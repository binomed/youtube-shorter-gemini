# Story 4.1: Manual Segment Capture (In/Out)

Status: done

## Story

As a creator,
I want to capture my own segments using hotkeys (I/O) during playback,
so that I have full control over the narrative flow.

## Acceptance Criteria

1. **Given** a playing video
2. **When** I press 'I' then 'O' or use the UI capture buttons
3. **Then** a new segment is added to the selection.
4. **And** the segment is immediately visible in the multi-timeline.
5. **Given** an existing segment in the multi-timeline
6. **When** I drag the start or end handles of the segment graphically
7. **Then** the In or Out points are adjusted accordingly and the video preview updates.
8. **And** a live timing indicator (e.g. `00:00:15`) updates continuously in real-time above or near the dragged handle to show the exact new boundary.
8. **And** the subtitles displayed in the main video preview update to reflect the new boundaries, excluding text outside the new timing selection.
9. **Given** a project that already has generated audio stems
10. **When** the boundaries (In/Out) of any segment are modified (via hotkeys or graphical adjustment)
11. **Then** the previously generated stems for that segment/project are deleted or invalidated because they no longer match the video cuts.

## Tasks / Subtasks

- [ ] Task 1: Initialize Front-end Capture Logic (AC: 1, 2)
  - [ ] Implement global keyboard event listeners in the video player component for 'I' (In) and 'O' (Out) keys.
  - [ ] Implement graphical capture buttons (In/Out) on the UI as an alternative to hotkeys.
  - [ ] Add visual feedback on the UI when 'I' or 'O' is pressed to denote a mark is created.
- [ ] Task 2: Implement Multi-Timeline Segment State (AC: 3, 4, 5, 8)
  - [ ] Introduce a Lit Signal state for holding multiple video segments (`startTime`, `endTime`) per project.
  - [ ] Build a `precision-multi-timeline` atom/molecule component to display captured segments linearly.
  - [ ] Implement draggable handles on the timeline segments to allow graphical adjustment of `startTime` and `endTime`.
  - [ ] Integrate a live numerical floating or fixed timing readout that updates synchronously with handle drag events (e.g. `00:00:15` near the handle).
  - [ ] Ensure that when Handles adjust the segment boundaries (`startTime`, `endTime`), a reactive trigger updates the active displayed subtitles to omit excluded text.
  - [ ] On capturing via 'O' (having set 'I' beforehand), push the newly formed segment sequence to the state array.
- [ ] Task 3: Align Segment Capture State with Backend via REST/SSE
  - [ ] Add DTOs in `packages/shared/dto/` for standardizing segment creation and updates (e.g., `CreateVideoSegmentDto`, `UpdateVideoSegmentDto`).
  - [ ] Create a `VideoSegmentsController` under `apps/back/modules/processing/` or `projects/` to handle segment persistence and updates.
  - [ ] Persist the segment inside SQLite immediately upon capture on the frontend utilizing the new API route.
- [ ] Task 4: Handle Stem Invalidation on Cut Changes (AC: 8, 9, 10)
  - [ ] In the backend segment update/creation logic, check if stems exist for the affected video/project.
  - [ ] If stems exist, delete the physical stem files from the filesystem to avoid desync.
  - [ ] Update the database state to reflect that stems are no longer available (e.g., reset `stemsAvailable` flag).
  - [ ] Ensure the frontend UI updates to show stems need to be regenerated.

## Dev Notes

- **Architecture Patterns and constraints:**
  - Standard REST pattern for posting the segment data (`CreateVideoSegmentDto`).
  - Strict utilization of Lit Signals for managing UI state reactively on segment addition without heavy frameworks.
  - Strict compliance with Atomic Design (e.g., Timeline component as a molecule).
  - Use Web accessibility standards (WCAG 2.1 AA). Ensure you can Tab to manual control buttons for I/O functions as an alternative to hotkeys.
- **Source tree components to touch:**
  - `apps/front/components/organisms/shorts-editor` (and its subcomponents context).
  - `packages/shared/dto/video-segments.ts`.
  - `apps/back/modules/processing/` (potentially a sub-controller or project service logic).
- **Testing standards summary:**
  - Expect to define test suites in Jest for the backend endpoints ensuring proper segment recording boundaries (`endTime` > `startTime`, non-overlapping logically if necessary).
  - Vitest / Playwright for UI testing of hotkey captures and state rendering matching the created Lit Signal.

### Project Structure Notes

- **Alignment with unified project structure (paths, modules, naming):** Follows `camelCase` for props/methods in Lit and standard NestJS class architecture. Ensure `.element.ts` extension for generic frontend Lit components.
- **Detected conflicts or variances:** None. Segment model should integrate perfectly via the established Monorepo strategy.

### References

- [Source: _bmad-output/planning-artifacts/prd.md#Functional Requirements] (FR14) - Composition de Shorts à partir d'un nombre illimité de séquences non-contigues (capture In-Out).
- [Source: _bmad-output/planning-artifacts/ux-design-specification.md#2.1 Mechanics] - Modèle de Capture: "On capture un segment en cliquant sur un bouton ou via raccourcis clavier."
- [Source: _bmad-output/planning-artifacts/architecture.md#Frontend Architecture] - State Management: Lit Signals natif.

## Dev Agent Record

### Agent Model Used

gemini-2.5-pro

### Debug Log References
- Extracted Story 4.1 "Manual Segment Capture (In/Out)".
- Included explicit UX interactions and technical Architecture paradigms (Lit Signals).

### Completion Notes List
- Ultimate context engine analysis completed - comprehensive developer guide created.

### File List
- _bmad-output/implementation-artifacts/4-1-multi-segment-composition-jump-cuts.md
