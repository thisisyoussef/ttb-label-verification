# Eval Brief

## Story

- Story ID: `TTB-EVAL-001`
- Title: golden eval set foundation and run discipline

## AI behavior being changed

This story does not change a model directly. It defines the golden cases and slices that every later extraction, validator, recommendation, evidence-model, batch, and error-handling change must evaluate against.

## Expected gain

- Stable quality gate for later AI, validator, batch, and error-path work
- Shared seeded-state language for Claude and Codex
- Repeatable evidence for regressions and demo claims

## Failure modes to catch

- prompt or validator changes that flip the expected recommendation for a golden baseline case
- warning defects being missed
- cosmetic mismatches being treated as hard failures
- low-quality images incorrectly upgraded to `pass`
- undocumented scenario changes hidden under old IDs

## Eval inputs or dataset slice

- `core-six`
- `beverage-type-coverage`
- `format-compliance`
- `deterministic-comparison`
- `cross-field-dependencies`
- `government-warning-edge-cases`
- `standalone-mode`
- `batch-processing`
- `error-handling`

## Pass criteria

- Every implementation story can name the smallest applicable golden slice it touches.
- Every later eval run uses the checked-in result template.
- The core six remain stable unless an explicit corpus change story is added, and the wider golden catalog stays slice-addressable.
