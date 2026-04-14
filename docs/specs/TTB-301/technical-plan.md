# Technical Plan

## Server

- Keep batch state in an in-memory `BatchSessionStore`.
- Parse CSV uploads in `src/server/batch-csv.ts`.
- Match files to rows in `src/server/batch-matching.ts` using filename-first matching and order fallback.
- Reuse `createNormalizedReviewIntake`, `createOpenAIReviewExtractor`, `buildGovernmentWarningCheck`, and `buildVerificationReport` for each selected batch item.
- Stream run frames from `/api/batch/run` as NDJSON.

## Client

- Keep fixture mode intact for dev-only seeds.
- In non-fixture runtime, let `BatchUpload` accept real files and call live preflight.
- Adapt batch API payloads into the approved batch view models through `src/client/batch-runtime.ts`.
- Fetch live summary/report/export/retry endpoints without changing the approved layout or copy structure.
