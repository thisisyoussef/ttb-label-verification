# Story Packet

## Metadata

- Story ID: `TTB-201`
- Title: shared review contract expansion and seed fixture alignment
- Parent: `TTB-002`
- Primary lane: Codex
- Packet mode: compact planning packet

## Constitution check

- Engineering-only story.
- Must preserve approved UI expectations from `TTB-102`.
- Must begin with failing contract tests.
- No frontend redesign allowed.

## Feature spec

### Problem

The current shared contract only supports a scaffold result. The single-label UI needs a richer, stable contract before live intake and validation can be wired safely.

### Acceptance criteria

- Shared contract covers recommendation banner, counts, checklist rows, detail surfaces, warning evidence, cross-field checks, and standalone/comparison mode signals.
- Seed fixture remains valid against the expanded schema until live behavior replaces it.
- Contract terminology matches the approved UI and leaves no ambiguous fields for later stories.

## Technical plan

- Primary files: `src/shared/contracts/review.ts` and tests under `src/shared/contracts`.
- Expand the top-level report, row, evidence, and warning-detail shapes.
- Add or update contract tests first.

## Task breakdown

1. Derive contract requirements from the approved UI handoff.
2. Write failing contract tests.
3. Expand the shared schemas and seed fixtures.
4. Verify the UI-facing contract shape is stable.
5. Update downstream story assumptions in the packet or parent docs if needed.
