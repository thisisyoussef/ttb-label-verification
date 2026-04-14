# Performance Budget

## Story

- Story ID: `TTB-208`
- Title: cloud/default latency observability and sub-4-second budget framing

## Current contract

- The checked-in report contract still advertises `latencyBudgetMs: 5000`.
- This story does not change that user-facing value yet.

## Target envelope to optimize against

### Happy path (`primary provider` succeeds)

- intake parse + normalization: `<= 150 ms`
- provider selection + request assembly: `<= 100 ms`
- primary provider call: `<= 2,600 ms`
- deterministic validation + report shaping: `<= 400 ms`
- serialization + route margin: `<= 450 ms`

Target subtotal: `<= 3,700 ms`

### Fast-fail fallback (`primary` fails quickly, `secondary` recovers)

- intake parse + normalization: `<= 150 ms`
- primary fast-fail detection: `<= 300 ms`
- fallback handoff + second request assembly: `<= 100 ms`
- secondary provider call: `<= 2,500 ms`
- deterministic validation + report shaping: `<= 400 ms`
- response margin: `<= 450 ms`

Target subtotal: `<= 3,900 ms`

### Late-fail rule

If the primary provider has already consumed enough time that a second full provider attempt cannot finish within the target envelope, the route must return a structured retryable error instead of exceeding `4,000 ms`.

## Measurement method

- Capture stage spans for:
  - primary success
  - forced fast-fail fallback
  - forced late-fail retryable exit
- Record total and per-stage durations in story artifacts and `evals/results/`.
- Keep the visible `latencyBudgetMs` contract at `5000` until `TTB-209` proves the cutover.

## Measured checkpoint (2026-04-14)

### Fixture-backed endpoint seam

- `/api/review` (`G-02`): outer route `59 ms`, internal measured stages `16 ms`, path `primary-success`
- `/api/review/extraction` (`G-01`): outer route `5 ms`, internal measured stages `2 ms`, path `primary-success`
- `/api/review/warning` (`G-01`): outer route `5 ms`, internal measured stages `2 ms`, path `primary-success`
- `/api/batch/run` (`G-34`): outer route `15 ms`, internal per-item measured stages `2 ms`, path `primary-success`

These fixture runs prove the route and batch surfaces now emit bounded, privacy-safe summaries without changing the public response contract.

### Routed-path observer probes

- primary success: `12 ms`, provider order `gemini -> openai`, path `primary-success`
- fast-fail fallback: `1 ms`, provider order `gemini -> openai`, path `fast-fail-fallback-success`
- late-fail retryable exit: `17 ms`, provider order `gemini -> openai`, path `late-fail-retryable`
- pre-provider failure: `0 ms`, path `pre-provider-failure`

These probes classify the intended timing paths and fallback branches on the real route graph. The custom provider stubs used in those probes do not exercise adapter-level request assembly or provider wait spans.

### Cloud baseline carried forward from `TTB-207`

- sanitized clean PDF: Gemini `4548 ms`, OpenAI `11612 ms`
- sanitized warning-defect PDF: Gemini `5284 ms`, OpenAI `11394 ms`
- sanitized blank PDF: Gemini `4419 ms`, OpenAI `9920 ms`

The cloud baseline is still above the tighter `<= 4000 ms` target on real provider calls, which is why this story leaves `latencyBudgetMs` at `5000` and hands the actual cutover to `TTB-209`.
