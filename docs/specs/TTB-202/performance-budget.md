# Performance Budget

## Story

- Story ID: `TTB-202`
- Title: single-label upload intake, normalization, and ephemeral file handling

## Budget slice

- Multipart parsing and route validation: under 250 ms for a normal single-image request
- Intake normalization: under 25 ms
- Seed response serialization: under 25 ms

## Measurement method

- Use the existing Vitest route tests as a guardrail for correctness.
- For local spot checks, measure a `POST /api/review` request against the dev server with a representative JPEG and confirm the total round-trip remains comfortably inside the product-wide 5-second budget.

## Measured result

- 2026-04-13 local spot check (`NODE_ENV=test node --import tsx --eval ...` against `createApp()` on an ephemeral port):
  - `POST /api/review` with one representative JPEG plus populated `fields`: `29.19 ms`
  - `createNormalizedReviewIntake()` over 1,000 iterations: `0.34 ms` total, `0.0003 ms` average per iteration
- Result: this story stays well inside the intake slice budget and does not materially cut into the later extraction budget.

## Story note

- This story does not add extraction work, so its performance responsibility is to avoid introducing intake overhead that meaningfully cuts into the later model budget.
