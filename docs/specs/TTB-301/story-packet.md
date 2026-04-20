# Story Packet

## Metadata

- Story ID: `TTB-301`
- Title: batch parser, matcher, orchestration, and session export
- Parent: `TTB-003`
- Primary lane: Codex
- Packet mode: completed implementation packet

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

## Implementation summary

- Added batch schemas and constants to `src/shared/contracts/review.ts` for preflight, streaming run frames, dashboard rows, export payloads, and retry/summary contracts.
- Added `src/server/batch/batch-csv.ts`, `src/server/batch/batch-matching.ts`, and `src/server/batch/batch-session.ts` to parse CSV uploads, build filename-first/order-fallback matching, keep session data in memory only, stream sequential batch execution, and assemble dashboard/export payloads from the existing single-label report builder.
- Extended `src/server/index.ts` with batch endpoints:
  - `POST /api/batch/preflight`
  - `POST /api/batch/run`
  - `POST /api/batch/:batchSessionId/cancel`
  - `GET /api/batch/:batchSessionId/summary`
  - `GET /api/batch/:batchSessionId/report/:reportId`
  - `GET /api/batch/:batchSessionId/export`
  - `POST /api/batch/:batchSessionId/retry/:imageId`
- Wired the approved batch UI shell in `src/client/**` to the live batch engine without redesigning the screens:
  - `BatchUpload` now accepts real files in non-fixture runtime
  - `App.tsx` now drives live preflight, stream consumption, dashboard fetch, report fetch, export download, and retry
  - `BatchDrillInShell` now consumes a fetched live `VerificationReport` when available and falls back to fixture scenarios only in fixture mode
- Added `src/client/batch-runtime.ts` to keep the UI adaptation layer pure and testable.

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

## Verification

- `npm run test`
- `npm run typecheck`
- `npm run build`
- Live production-build smoke on `http://127.0.0.1:8796`:
  - app shell served successfully
  - real multipart batch preflight returned `200` with `matched=2`
  - real `/api/batch/run` returned streamed frames and a terminal summary
  - real `/api/batch/:session/summary` preserved submitted CSV `brandName` values in rows
  - real `/api/batch/:session/export` returned `200`
  - real retry route returned `200` with refreshed dashboard payload

## Remaining gaps

- Successful corpus-grade live batch verification is still blocked by the extractor returning structured `network` errors locally and by the missing binary eval assets under `evals/labels/assets/`.
