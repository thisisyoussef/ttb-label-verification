# Eval Brief

## Story

- Story ID: `TTB-EVAL-001`
- Title: six-label eval corpus and run discipline

## AI behavior being changed

This story does not change a model directly. It defines the baseline cases that every later extraction, validator, recommendation, and evidence-model change must evaluate against.

## Expected gain

- Stable quality gate for later AI and validator work
- Shared seeded-state language for Claude and Codex
- Repeatable evidence for regressions and demo claims

## Failure modes to catch

- prompt or validator changes that flip the expected recommendation for a baseline case
- warning defects being missed
- cosmetic mismatches being treated as hard failures
- low-quality images incorrectly upgraded to `pass`
- undocumented scenario changes hidden under old IDs

## Eval inputs or dataset slice

- `perfect-spirit-label`
- `spirit-warning-errors`
- `spirit-brand-case-mismatch`
- `wine-missing-appellation`
- `beer-forbidden-abv-format`
- `low-quality-image`

## Pass criteria

- Every implementation story can name the relevant cases it touches.
- Every later eval run uses the checked-in result template.
- The six baseline cases remain stable unless an explicit corpus change story is added.
