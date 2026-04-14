# Technical Plan

## Scope

Move the default cloud label-extraction path to Gemini-first while preserving the existing typed extraction contract and keeping OpenAI available as the bounded fallback provider inside cloud mode.

## Planned modules and files

- `src/server/gemini-review-extractor.ts`
  - native Google GenAI SDK adapter for image/PDF extraction using structured JSON output
- `src/server/gemini-review-extractor.test.ts`
  - request-building, normalization, and provider-failure coverage
- `src/server/ai-provider-policy.ts`
  - consume the `cloud` mode plus `label-extraction=gemini,openai` order and enforce fast-fail fallback rules
- `src/server/review-extractor-factory.ts`
  - instantiate Gemini first, OpenAI second, and return the winning cloud provider
- `src/server/openai-review-extractor.ts`
  - remain the fallback adapter with existing Responses + `store: false` behavior
- `src/server/index.ts`
  - route `/api/review`, `/api/review/extraction`, and `/api/review/warning` through the Gemini-primary cloud factory path
- `src/server/batch-session.ts`
  - inherit the same cloud-mode label-extraction provider order for item processing
- `scripts/bootstrap-local-env.ts`
  - add Gemini keys/models and provider-order defaults

## Provider choice

The first implementation candidate should use the native Google GenAI SDK, not the OpenAI-compatibility layer, for multimodal label extraction.

Why:

- Google’s official partner guidance recommends the GenAI SDK for end-user applications and calls out the OpenAI compatibility layer as a text-oriented portability path with a lower feature ceiling.
- The current OpenAI code relies on Responses semantics; the compatibility layer is not a guaranteed drop-in for that surface.
- Gemini’s native structured-output and document-understanding docs explicitly cover JSON schema output plus inline PDF/image handling.

Official sources:

- GenAI SDK guidance and compatibility trade-offs: https://ai.google.dev/gemini-api/docs/partner-integration
- Structured outputs: https://ai.google.dev/gemini-api/docs/structured-output
- Document understanding: https://ai.google.dev/gemini-api/docs/document-processing

## Model-selection plan

- Default candidate: `Gemini 2.5 Flash`
  - official positioning: best price/performance for low-latency, high-volume tasks
- Secondary candidate if latency or cost needs a lighter path: `Gemini 2.5 Flash-Lite`
- Do not freeze a preview-only Gemini model as the repo default without trace evidence and an explicit rollback note.

Reference: https://ai.google.dev/gemini-api/docs/models

## Request-building plan

- Images:
  - send inline image bytes from the in-memory upload path
- PDFs:
  - send inline PDF bytes from the in-memory upload path
- Structured output:
  - Gemini `responseMimeType: "application/json"`
  - Gemini `responseJsonSchema` generated from the API-facing extraction schema

The repo’s current upload cap is 10 MB, which fits under Gemini’s documented PDF limit and avoids the need for provider-side file storage.

## Fallback policy

- Fast-fail fallback allowed:
  - missing/invalid Gemini key
  - 429 / 5xx upstream failures
  - immediate connection / DNS / TLS failures
  - explicit retriable schema/transport failures classified by the adapter
- Fail-closed, no fallback:
  - explicit `local` execution mode
  - Gemini Files API requirement
  - privacy-policy violation
  - unsupported capability mismatch
  - deterministic normalization bug in repo code
- Single-label latency rule:
  - only fast failures may chain to OpenAI
  - late primary timeouts return a structured retryable error instead of spending a second full extraction budget
- Batch rule:
  - broader fallback is acceptable than the single-label path, but retry/backoff must still respect provider rate limits

## Risks and fallback

- Risk: Gemini field coverage is weaker than OpenAI on warning text or label typography.
  - Fallback: tighten schema/prompt guidance one variable at a time through trace-driven development; keep OpenAI fallback active.
- Risk: Gemini latency plus fallback overhead breaks the sub-5-second target.
  - Fallback: fast-fail-only single-label fallback; late failures return retryable error and preserve budget discipline.
- Risk: AI Studio project settings drift and logging gets enabled later.
  - Fallback: keep the privacy checklist explicit, document the project requirement, and fail deployment review if the setting cannot be verified.

## Testing strategy

- unit:
  - Gemini request building for image and PDF inputs
  - Gemini structured-output normalization
  - fallback eligibility classification
- contract:
  - route responses preserve the current shared extraction/report contract
  - non-default submitted fields survive through Gemini-primary and OpenAI-fallback paths
- integration:
  - `/api/review`, `/api/review/extraction`, `/api/review/warning`
  - batch item processing through the same provider router
- eval and traces:
  - compare Gemini-primary vs OpenAI-only on the approved fixture slice
- mutation-worthy modules:
  - fallback classifier and any new pure normalization helpers
