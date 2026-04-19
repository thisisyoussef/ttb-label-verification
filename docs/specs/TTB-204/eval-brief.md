# Eval Brief

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Behavior being changed

This story turns warning extraction output into deterministic warning validation, diff evidence, and a warning-only backend route.

## Expected gain

- Catch the showcase warning defect case reliably.
- Keep low-quality warning reads explicit about uncertainty.
- Stop treating body-case differences as a second compliance defect when the wording is otherwise exact.
- Produce warning evidence that matches the approved results UI contract.

## Failure modes to catch

- wrong-case heading being missed
- warning-body case noise causing a hard fail even when the wording is otherwise exact
- punctuation defects not appearing in the diff
- case-only phrase grouping becoming unreadable in the diff output
- low-confidence warning reads being escalated to hard failure
- a bold-only visual `no` being surfaced as a confident format failure on an otherwise correct heading
- missing-word defects being counted twice through both exact-text and a second warning-only downgrade
- warning route drifting from the shared `CheckReview` schema

## Eval inputs or dataset slice

- `spirit-warning-errors`
- `low-quality-image`
- targeted unit fixtures for body-case-only warning variants
- targeted unit fixtures for phrase-level diff shaping
- route integration tests for `POST /api/review/warning`
- 2026-04-19 follow-up live slices from `evals/golden/manifest.json`
  - `cola-cloud-warning-visible`
  - `cola-cloud-warning-not-visible`
  - diagnostic run records in `evals/results/2026-04-19-warning-diagnostics-*.json`

## Pass criteria

- the warning defect case returns `fail`
- the low-quality path returns `review`
- body-case-only variants stay `pass` or `review` through exact-text, with the separate heading check carrying the uppercase/bold requirement
- bold-only negatives stay `review` unless another detector corroborates the formatting defect
- warning evidence exposes the fixed five sub-check IDs and ordered diff segments
- no extra model call is introduced beyond the existing extraction call
- warning-not-visible cases stay isolated from visible-warning regressions and resolve to `review`
- tiny or vertical warning headings do not hard-fail only because OCR casing is unstable

## Follow-up findings

- The 2026-04-19 live warning split confirmed the front-only or warning-not-visible bucket stays uniformly `review`, which makes visible-warning failures easier to diagnose in isolation.
- The heading-format path is now intentionally conservative: bold uncertainty and OCR-only casing noise fall back to `review` unless a stronger visual signal supports `fail`.
- Exact-text still shows run-to-run instability on a small subset of visible warnings when both OCR and VLM collapse wording in the same run, so the diagnostic artifacts should remain the reference point for the next warning-only extraction iteration.
