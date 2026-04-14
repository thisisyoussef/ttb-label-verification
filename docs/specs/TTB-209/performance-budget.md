# Performance Budget

## Story

- Story ID: `TTB-209`
- Title: single-label hot-path optimization to `<= 4 seconds`

## Final target

- End-to-end single-label target: `<= 4,000 ms`

## Happy-path budget (`primary provider` succeeds)

- intake parse + normalization: `<= 150 ms`
- provider selection + request assembly: `<= 100 ms`
- primary provider call: `<= 2,600 ms`
- deterministic validation + report shaping: `<= 400 ms`
- serialization + route margin: `<= 450 ms`

Target subtotal: `<= 3,700 ms`

## Fast-fail fallback budget (`primary` fails quickly, `secondary` recovers)

- intake parse + normalization: `<= 150 ms`
- primary fast-fail detection: `<= 250 ms`
- fallback handoff + second request assembly: `<= 100 ms`
- secondary provider call: `<= 2,500 ms`
- deterministic validation + report shaping: `<= 400 ms`
- response margin: `<= 450 ms`

Target subtotal: `<= 3,850 ms`

## Late-fail rule

If the primary provider has already consumed enough time that the remaining budget cannot support a second full provider attempt plus deterministic work, return a structured retryable error before crossing `4,000 ms`.

## Measurement method

- measure route-level latency for:
  - optimized primary success
  - forced fast-fail fallback
  - forced late-fail retryable exit
  - narrower extraction-only and warning-only routes
- record timings in the story packet and `evals/results/`
- update the shared contract to `latencyBudgetMs: 4000` only after the measured proof is in hand
