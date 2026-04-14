# Performance Budget

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## Default cloud single-label target

- End-to-end target remains under 5 seconds.

## Happy-path budget (`gemini` succeeds)

- request normalization + provider selection: `<= 250 ms`
- in-memory media encoding + request assembly: `<= 150 ms`
- Gemini extraction call: `<= 3000 ms`
- deterministic validation + report shaping: `<= 500 ms`
- serialization + route response margin: `<= 600 ms`

Target subtotal: `<= 4500 ms`

## Fast-fail fallback budget (`gemini` fails quickly, `openai` recovers)

- request normalization + provider selection: `<= 250 ms`
- Gemini fast-fail detection: `<= 500 ms`
- fallback handoff and second-request assembly: `<= 150 ms`
- OpenAI fallback extraction: `<= 3000 ms`
- deterministic validation + report shaping: `<= 500 ms`
- response margin: `<= 400 ms`

Target subtotal: `<= 4800 ms`

## Late-failure rule

If Gemini has already consumed the fast-fail budget and still has not returned, the single-label path must not start a second full extraction call. It should return a structured retryable error instead of exceeding the interactive budget.

## Measurements recorded on 2026-04-14

- Current default-timeout smoke runs (sanitized, traced extraction surface):
  - clean PDF with `GEMINI_TIMEOUT_MS=3000`: timed out at roughly `3082 ms`
  - clean PNG with `GEMINI_TIMEOUT_MS=3000`: timed out at roughly `3051 ms`
- Sanitized PDF provider comparison (real providers, traced extraction surface):
  - Gemini clean PDF: `4548 ms`
  - Gemini warning-defect PDF: `5284 ms`
  - Gemini blank PDF: `4419 ms`
  - OpenAI clean PDF: `11612 ms`
  - OpenAI warning-defect PDF: `11394 ms`
  - OpenAI blank PDF: `9920 ms`
- Sanitized PNG smoke run (real Gemini, traced extraction surface, temporary `GEMINI_TIMEOUT_MS=12000`):
  - clean PNG: `10041 ms`
- Forced router behavior (injected providers through `createApp`):
  - fast retryable Gemini network failure with OpenAI recovery: `258 ms`, `200` response, fallback model `gpt-5.4`
  - late retryable Gemini timeout beyond the fallback budget: `344 ms`, `504` response, no fallback attempt

## Interpretation

- The fallback classifier behaves as intended: fast failures can recover quickly, and late failures fail closed without starting a second provider call.
- Gemini Flash-Lite beat OpenAI materially on the sanitized PDF slice, but the measured success path still exceeded the story's planned `3000 ms` extraction target on two of three PDF traces and far exceeded it on the sanitized PNG smoke pass.
- `TTB-208` must record stage timing on the real routed path, and `TTB-209` must tune timeout/deadline policy before the Gemini default can be treated as production-ready.
