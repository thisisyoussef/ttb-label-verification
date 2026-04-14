# Eval Brief

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## AI behavior being changed

This story swaps the live cloud extraction default from OpenAI-only to Gemini-primary with OpenAI fallback on the single-label and batch paths.

## Expected gain

- reduce single-provider dependence for image/document understanding
- preserve deterministic validator behavior while changing only the extraction provider
- make Gemini the preferred multimodal path if it meets the repo’s quality, privacy, and latency gates

## Failure modes to catch

- warning text extraction regresses relative to OpenAI
- Gemini fails on PDF input that OpenAI currently accepts
- Gemini parse/schema failures are incorrectly treated as successful extraction
- fallback triggers on privacy-policy failures instead of failing closed
- single-label fallback chains too late and breaks the latency target
- batch execution creates repeated fallback storms that hide a provider outage

## Eval inputs or dataset slice

- approved local fixture slice used for trace-driven development
- live core-six subset from `evals/labels/manifest.json` when assets are available
- one forced-failure slice that proves OpenAI fallback behavior

## Pass criteria

- contract tests prove route payload stability
- adapter tests prove inline image/PDF packaging and failure classification
- trace results identify the winning Gemini model and any schema/prompt adjustments
- live eval results either show parity/better behavior or record the exact blocker and rollback condition
