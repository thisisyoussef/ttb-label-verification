# Constitution Check

## Story

- Story ID: `TTB-202`
- Title: single-label upload intake, normalization, and ephemeral file handling
- Lane: Codex
- Status: in progress

## Lane-scoped rules

1. Keep upload handling ephemeral. No temp files, durable caches, or persistent logs.
2. Use TDD for request-validation and normalization behavior.
3. Preserve the approved UI; only narrow request-wiring edits are allowed in `src/client/**`.
4. Prepare a normalized intake surface that `TTB-203` can consume without re-parsing multipart input inline.

## In scope

- `src/server/**` request intake and normalization
- narrow `src/client/**` request wiring if needed to honor optional application-data semantics
- `docs/specs/TTB-202/` packet expansion
- tracker, memory, and handoff progress updates tied to this story

## Out of scope

- OpenAI extraction
- Deterministic validator logic
- UI redesign
- Persistence, queues, background jobs, or export routes
