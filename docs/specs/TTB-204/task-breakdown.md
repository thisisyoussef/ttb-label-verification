# Task Breakdown

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Tasks

1. Write RED tests for warning normalization, diff shaping, status mapping, and route output.
2. Export the canonical government warning text from the shared contract.
3. Implement a pure warning validator in `src/server/validators/government-warning-validator.ts`.
4. Add `POST /api/review/warning` as the warning-only staging surface.
5. Update warning evidence and rule-source docs with final semantics.
6. Run targeted tests, then the full verification stack.
7. Record eval and bookkeeping updates for the handoff into `TTB-205`.
