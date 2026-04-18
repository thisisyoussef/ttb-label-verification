# Performance Budget

## Single-label target

- keep the user-facing single-label latency target at or under `5000 ms`

## Story-specific checks

- compare one-image versus two-image request timing on the single-label path
- confirm that adding an optional second image does not create avoidable client-side blocking before the request starts
- note any provider-specific degradation introduced by two-image cloud extraction

## Batch note

Batch mode is not bound to the single-label five-second budget, but row-level orchestration should not duplicate work by treating the second image as a separate application.

## 2026-04-18 note

- this branch keeps the public `latencyBudgetMs` contract unchanged at `5000`
- no dedicated live two-image latency benchmark was recorded in this branch
- the feature does avoid stale extraction reuse by hashing all ordered label buffers for the extraction prefetch cache key
