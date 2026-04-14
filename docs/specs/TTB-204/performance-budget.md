# Performance Budget

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Budget

- No additional model call is allowed in this story.
- Warning validation and diff shaping should remain deterministic in-process work after extraction.
- Local validator compute should be effectively negligible relative to the extraction call and must not threaten the product-level single-label target of under 5 seconds.

## Measurement plan

- Measure the warning-only route locally after implementation.
- Record total route time as extraction + validation.
- Treat any noticeable regression as an extraction-path issue unless deterministic validator compute itself becomes material.

## Observed 2026-04-13

- Local live spot-check: `POST /api/review/warning` against `/tmp/README.md.png`
- Result: `200`, `government-warning`, `review`
- Total route time: `7632 ms`
- Interpretation:
  - This exceeds the product-level under-5-second target.
  - The request used a non-corpus PNG rather than a real label asset.
  - The warning validator itself added no extra model call; the latency pressure remains on the extraction path and must be re-measured on the real label corpus once the missing assets exist.
