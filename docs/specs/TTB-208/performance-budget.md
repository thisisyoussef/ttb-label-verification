# Performance Budget

## Story

- Story ID: `TTB-208`
- Title: latency observability and sub-4-second budget framing

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
