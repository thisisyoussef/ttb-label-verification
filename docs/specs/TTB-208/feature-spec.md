# Feature Spec

## Story

- Story ID: `TTB-208`
- Title: cloud/default latency observability and sub-4-second budget framing

## Problem statement

The repo currently exposes a static `latencyBudgetMs: 5000` contract and a handful of ad hoc timing notes, but it does not have a typed way to measure where the single-label path spends time. Without stage-level timing and a documented sub-4-second budget, the follow-on optimization work would be guesswork.

## User-facing outcomes

- Review latency regressions become diagnosable instead of anecdotal.
- The release gate can prove a tighter single-label timing target with stage evidence, not just a total stopwatch value.
- The approved UI stays unchanged while engineering gets the data needed to tune the hot path.

## Acceptance criteria

1. The server has a typed latency-span model for the single-label path that can capture: intake parse, normalization, provider selection, request assembly, primary provider wait, fallback handoff, fallback provider wait, deterministic validation, report shaping, and total duration.
2. Stage timing is available for `POST /api/review`, `POST /api/review/extraction`, `POST /api/review/warning`, and per-item batch execution.
3. The measurement path distinguishes primary success, fast-fail fallback, and late-fail retryable exits.
4. Timing data is available to tests, eval runs, and controlled local diagnostics without changing the approved UI contract or leaking sensitive input content.
5. The story packet defines a future `<= 4,000 ms` target envelope for happy-path and fallback-path execution, but the public `latencyBudgetMs` contract remains `5000` until `TTB-209` proves the cutover.
6. Privacy rules for latency instrumentation are explicit and testable: no raw payload logging, no durable timing artifacts containing user content, and no cache feature that would persist submitted data just to improve latency.

## Edge cases

- The extractor is unavailable before any provider call starts.
- The primary provider succeeds with no fallback.
- The primary provider fails quickly and a fallback attempt begins.
- The primary provider fails too late for a second full provider call inside the target window.
- Batch cancellation interrupts per-item timing collection.
- The no-text path returns early and should still produce a coherent timing record.

## Out of scope

- Claiming the product already meets `<= 4,000 ms`.
- Flipping the visible report contract from `5000` to `4000`.
- Enabling provider priority tiers, caching features, or media-resolution tuning by default.
- UI changes or new reviewer-facing evidence fields.
