# Story 4.2: Real-time Jump-Cut Preview

Status: backlog

## Story

As a creator,
I want to see the sequence of my segments with jump-cuts immediately,
so that I can verify the edit without waiting for a full render.

## Acceptance Criteria

1. **Given** multiple segments in a Short
2. **When** the player reaches the end of a segment
3. **Then** it jumps immediately to the start of the next one.
4. **And** the progress bar reflects the cumulative duration of all segments.
5. **And** SSE events provide real-time feedback on background processing stages (analysis/render status).

## Tasks / Subtasks

- [ ] Task 1: Re-enable Multi-Segment Support in Frontend
  - [ ] Update `yts-precision-multi-timeline.element.ts` to support multiple segments.
  - [ ] Update `editor-page.ts` to manage an array of segments instead of a single object.
  - [ ] Ensure 'I' key can add a new segment if the previous one is closed ('O').
- [ ] Task 2: Implement Jump-Cut Playback Logic
  - [ ] Modify `short-player.ts` to iterate through segments.
  - [ ] Implement auto-seek to the next segment's `startTime` when the current segment's `endTime` is reached.
  - [ ] Loop playback from the last segment's end back to the first segment's start.
- [ ] Task 3: Cumulative Progress Tracking
  - [ ] Update the player's progress bar to show position relative to the sum of all segments.
  - [ ] Ensure time display (e.g., `00:15 / 00:45`) reflects total composed duration.
- [ ] Task 4: Backend Support for Multi-Segment Sync
  - [ ] Update `AnalysisService.updateShortSegments` to filter subtitles across all segments (OR logic).
  - [ ] Ensure `stemsAvailable` flag and invalidation logic work correctly for the entire collection of segments.

## Dev Notes

- **Playback Strategy**: Use the HTML5 `timeupdate` event to trigger seeks. For smoother transitions, consider a "look-ahead" jump slightly before the absolute end.
- **State Management**: Use Lit Signals to bubble up segment changes from the timeline to the global project state.
- **API**: The `segments` field in the `Short` entity is already a JSON array, so the schema supports this without migrations.
