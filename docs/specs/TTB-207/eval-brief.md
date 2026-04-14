# Eval Brief

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## AI behavior being changed

This story swaps the live cloud extraction default from OpenAI-only to Gemini-primary with OpenAI fallback on the single-label and batch paths.

## Expected gain

- reduce single-provider dependence for image/document understanding
- preserve deterministic validator behavior while changing only the extraction provider
- make Gemini the preferred multimodal path if it meets the repo's quality, privacy, and latency gates

## Failure modes to catch

- warning text extraction regresses relative to OpenAI
- Gemini fails on PDF input that OpenAI currently accepts
- Gemini parse/schema failures are incorrectly treated as successful extraction
- fallback triggers on privacy-policy failures instead of failing closed
- single-label fallback chains too late and breaks the latency target
- batch execution creates repeated fallback storms that hide a provider outage

## Eval inputs or dataset slice

- fixture-backed endpoint slices from `npm run eval:golden`:
  - `endpoint-review`
  - `endpoint-extraction`
  - `endpoint-warning`
  - `endpoint-batch`
- sanitized locally generated provider-comparison slice:
  - `sanitized-clean`
  - `sanitized-warning-defect`
  - `sanitized-no-text`
- forced-failure route measurements for fast fallback and late timeout behavior

## Pass criteria

- contract tests prove route payload stability
- adapter tests prove inline image/PDF packaging and failure classification
- trace results identify the winning Gemini model and any schema/prompt adjustments
- live or sanitized comparison results either show parity/better behavior or record the exact blocker and rollback condition

## Recorded result

- `LANGSMITH_TRACING=true npm run eval:golden` passed on 2026-04-14 with 18/18 fixture-backed endpoint evals green.
- Sanitized local comparison traces favored `gemini-2.5-flash-lite` over `gpt-5.4` on the generated PDF slice and preserved no-text behavior on both providers.
- The live core-six image-backed subset is still blocked by the missing binaries under `evals/labels/assets/`.
- The story still carries a non-production-ready note because the current `GEMINI_TIMEOUT_MS=3000` default timed out on sanitized clean PDF and PNG smoke runs, and Gemini project logging settings still require manual verification.
