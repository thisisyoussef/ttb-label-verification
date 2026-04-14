# Golden Eval Set

This directory is the canonical golden test set for the TTB Label Verification app.

Use it as the source of truth for:

- engineering eval planning
- seeded UI scenario selection
- QA acceptance checks
- demo case selection

## Canonical files

- `manifest.json` — full golden case catalog and named slices

## Harness model

The eval harness now has two layers:

1. `evals/golden/manifest.json`
   - full golden set
   - all 40 cases
   - grouped into named slices so stories can run only what is applicable

2. `evals/labels/manifest.json`
   - live image-backed core-six subset
   - stable runtime slugs used by seeded UI states
   - the subset that blocks only when a story truly needs real label binaries

## Slice guidance

Use the smallest applicable slice:

- `core-six`
  - default demo set
  - default seeded UI baseline
  - default live single-label extraction/validation regression slice

- `beverage-type-coverage`
  - beverage-specific rule checks

- `format-compliance`
  - label-format rule checks

- `deterministic-comparison`
  - string and numeric comparison behavior that does not require live media

- `cross-field-dependencies`
  - multi-field rule interactions

- `government-warning-edge-cases`
  - warning-only validator coverage

- `standalone-mode`
  - image-only review mode without application data

- `batch-processing`
  - batch ingest, drill-in, export, and partial-match behavior

- `error-handling`
  - invalid upload, unreadable image, and wrong-product behavior

## Applicability rule

Do not run the entire golden set by reflex.

- extraction and live review stories usually start with `core-six`
- warning-only stories start with the warning slice plus the low-quality case
- comparison or aggregation stories should select only the relevant deterministic and cross-field slices
- UI stories should seed from `core-six` first, then add only the extra states they actually surface
- batch stories should use the batch slice
- upload or route hardening stories should use the error slice

## Asset rule

Only cases that explicitly require live label assets should block on missing binaries.

Deterministic comparison fixtures, batch summaries, and error-state expectations remain usable even when `evals/labels/assets/` is incomplete.

## Validation

Run `npm run evals:validate` after changing `evals/golden/manifest.json` or `evals/labels/manifest.json`.
