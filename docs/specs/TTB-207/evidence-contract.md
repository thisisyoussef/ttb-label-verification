# Evidence Contract

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## Surfaces affected

- API routes:
  - `POST /api/review`
  - `POST /api/review/extraction`
  - `POST /api/review/warning`
  - batch item execution through `POST /api/batch/run` and `POST /api/batch/retry`
- Shared contract file: `src/shared/contracts/review.ts`

## Contract requirements that stay stable

- Extraction payload shape stays the same as `TTB-203`.
- Warning and verification-report payload shapes stay the same as `TTB-204` and `TTB-205`.
- `noPersistence` remains `true` on extraction and report payloads.
- Deterministic validators continue to consume the same extraction fields and warning visual signals.

## New story-level evidence requirements

- `model` must identify the actual provider-backed model that produced the extraction.
- The returned payload must remain free of provider request dumps, raw JSON responses, or file ids.
- Retryable provider failures must surface as structured review errors when no safe fallback occurs.
- A successful OpenAI fallback must still return the normal extraction/report contract, not a provider-specific variant.

## Compatibility notes

- This story changes provider routing, not consumer payload shape.
- Any trace or eval provenance added for provider choice must stay outside the user-facing shared contract unless a later story explicitly promotes it.
