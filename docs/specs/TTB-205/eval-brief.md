# Eval Brief

## Story

- Story ID: `TTB-205`

## Minimum proof

- deterministic unit tests for comparison, beverage rules, cross-field checks, and aggregation
- route-level test proving submitted application values survive into `/api/review`

## Expected blocker

- Full live six-label eval is blocked by these missing binaries under `evals/labels/assets/`:
  - `perfect-spirit-label.png`
  - `spirit-warning-errors.png`
  - `spirit-brand-case-mismatch.png`
  - `wine-missing-appellation.png`
  - `beer-forbidden-abv-format.png`
  - `low-quality-image.png`
