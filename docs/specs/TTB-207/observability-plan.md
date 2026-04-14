# Observability Plan

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## Goal

Make provider selection, fallback behavior, and no-fallback failures visible from one route trace without exposing raw label or application data.

## Root trace surfaces

- `ttb.review_surface.execution` for `POST /api/review`
- `ttb.extraction_surface.execution` for `POST /api/review/extraction`
- `ttb.warning_surface.execution` for `POST /api/review/warning`
- `ttb.review_surface.execution` with batch surface metadata for item execution

## Required metadata

Every root trace should record:

- `endpointSurface`
- `extractionMode`
- configured provider order for label extraction
- actual provider used for the successful extraction, when known
- whether fallback was attempted
- fallback failure reason when a retryable Gemini attempt falls through
- `promptProfile`
- `guardrailPolicy`
- `clientTraceId` when present
- `fixtureId` when present
- `noPersistence=true`

## Required outputs

Every root trace should summarize:

- extraction model id
- stage timings in milliseconds
- whether the route completed on Gemini or OpenAI
- whether a second provider call was intentionally skipped because the timeout was too late
- verdict or warning status for user-visible routes

## Failure branches to keep explicit

- Gemini config missing and OpenAI fallback used
- Gemini immediate network failure and OpenAI fallback used
- Gemini timeout early enough for fallback
- Gemini timeout too late for fallback
- Gemini privacy-boundary or unsupported-capability failure with no fallback
- Gemini parse/normalization failure with no fallback

## Privacy guardrails

Do not log or trace:

- raw image or PDF bytes
- raw application field values
- raw provider JSON payloads
- durable file identifiers or file paths

Allowed trace content:

- mime type
- byte count
- populated field ids
- provider names
- bounded failure reason codes
- model ids
- fixture ids and correlation ids

## Verification branch

Use unit, route, and eval coverage to prove that:

- retryable Gemini failures are visible as fallback decisions
- non-retryable Gemini failures are visible as fail-closed decisions
- late-timeout branches are distinguishable from ordinary retryable failures
- batch items still emit enough metadata to tell when fallback storms are happening
