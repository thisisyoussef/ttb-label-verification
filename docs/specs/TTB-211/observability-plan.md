# Observability Plan

## Story

- Story ID: `TTB-211`
- Title: LLM endpoint and mode eval matrix, persona scorecards, and trace regression gates

## Goal

Make model-backed route behavior localizable from one root trace without relying on guesswork.

## Root trace surfaces

- `ttb.review_surface.execution` for `/api/review`
- `ttb.extraction_surface.execution` for `/api/review/extraction`
- `ttb.warning_surface.execution` for `/api/review/warning`
- `ttb.review_surface.execution` with `surface=/api/batch/run` for batch item execution
- `ttb.review_surface.execution` with `surface=/api/batch/retry` for retry execution

## Nested spans

- `ttb.review_extraction.stage`
- `ttb.warning_validation.stage`
- `ttb.review_report.stage`

## Required metadata

Every root trace should record:

- `endpointSurface`
- `extractionMode`
- `provider`
- `promptProfile`
- `guardrailPolicy`
- `clientTraceId` when present
- `fixtureId` when present
- `noPersistence=true`

## Required outputs

Every root trace should summarize:

- stage timings in milliseconds
- verdict or warning status for the user-visible route outcome
- extraction quality state where relevant
- check ids that remained in `review` or `fail` for integrated review routes

## Privacy guardrails

Do not trace:

- raw image bytes
- raw uploaded application field values
- durable file paths
- production or staging submissions

Allowed trace content:

- mime type
- byte count
- populated field ids
- bounded status summaries
- fixture ids and client correlation ids

## Verification branch

Use the fixture-backed endpoint gate to verify that:

- single-label review traces show extraction -> warning -> report
- extraction traces stop after extraction
- warning traces stop after warning validation
- batch retry traces stay distinguishable from the original batch run
