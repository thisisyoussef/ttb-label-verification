# Story Packet

## Metadata

- Story ID: `TTB-301`
- Title: batch parser, matcher, orchestration, and session export
- Parent: `TTB-003`
- Primary lane: Codex
- Packet mode: compact planning packet

## Constitution check

- Engineering-only story.
- Must keep batch work session-scoped with no durable workflow storage.
- Must preserve approved batch UI behavior without redesigning it.
- Must reuse the single-label evidence model.

## Feature spec

### Problem

The batch UI is only valuable once the backend can match files to rows, run bounded review jobs, and feed a stable triage dashboard.

### Acceptance criteria

- CSV parsing and matching are typed and testable.
- Batch processing runs with bounded concurrency and believable progress semantics.
- Dashboard rows and drill-in reuse the single-label evidence model.
- Export is generated without creating durable stored results.

## Technical plan

- Add parser, matcher, orchestration, and export modules under `src/server/**`.
- Extend the parent batch privacy and evidence assumptions when active.
- Keep batch session identity ephemeral.

## Task breakdown

1. Add failing tests for CSV parsing and file matching.
2. Implement batch normalization and session-scoped orchestration.
3. Add progress and summary shaping for the dashboard.
4. Implement export generation.
5. Run mixed batch validation and privacy checks.
