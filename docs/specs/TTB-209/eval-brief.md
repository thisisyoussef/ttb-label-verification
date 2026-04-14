# Eval Brief

## Story

- Story ID: `TTB-209`
- Title: cloud/default single-label hot-path optimization to `<= 4 seconds`

## Goal

Prove that the optimized latency profile meets the tighter timing target without materially regressing extraction quality.

## Evaluation focus

- total route duration on the approved latency fixture slice
- warning-text fidelity and field coverage under the winning low-latency profile
- fast-fail fallback correctness
- late-fail retryable behavior

## Failure modes to catch

- speed improves but warning-text extraction regresses
- low-latency model selection weakens beverage or field extraction
- cache-friendly request shaping changes structured-output behavior
- priority-tier downgrade hides a slower standard-tier result
- the visible budget flips to `4000` before the measured route proves it

## Pass criteria

- the optimized route meets the target envelope on the approved release-signoff fixture slice
- extraction quality remains acceptable against the existing eval set
- the story packet records the winning profile and rollback condition
