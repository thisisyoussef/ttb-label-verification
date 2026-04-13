# Story Packet

## Metadata

- Story ID: `TTB-202`
- Title: single-label upload intake, normalization, and ephemeral file handling
- Parent: `TTB-002`
- Primary lane: Codex
- Packet mode: compact planning packet

## Constitution check

- Engineering-only story.
- Must keep uploads ephemeral and avoid durable storage.
- Must use TDD for request validation and error handling.

## Feature spec

### Problem

The live single-label route needs safe request intake before extraction work can begin.

### Acceptance criteria

- Single-label route accepts the supported file types and optional application data.
- Request normalization is typed and bounded.
- Invalid type, oversize file, and malformed input failures map cleanly to user-facing states.
- No temp-file or log behavior violates the no-persistence rule.

## Technical plan

- Primary files: `src/server/index.ts` plus new intake or normalization modules under `src/server/**`.
- Extend the parent privacy checklist with concrete negative verification for this story.
- Keep file normalization and request validation isolated from model logic.

## Task breakdown

1. Add failing request-validation tests.
2. Implement request schema parsing and file constraints.
3. Add ephemeral handling or buffering logic with no durable writes.
4. Verify error semantics and privacy constraints.
5. Update the parent packet with concrete findings that later stories depend on.
