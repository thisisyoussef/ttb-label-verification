# Eval Brief

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Behavior being changed

This story turns warning extraction output into deterministic warning validation, diff evidence, and a warning-only backend route.

## Expected gain

- Catch the showcase warning defect case reliably.
- Keep low-quality warning reads explicit about uncertainty.
- Produce warning evidence that matches the approved results UI contract.

## Failure modes to catch

- wrong-case heading being missed
- punctuation defects not appearing in the diff
- case-only phrase grouping becoming unreadable in the diff output
- low-confidence warning reads being escalated to hard failure
- warning route drifting from the shared `CheckReview` schema

## Eval inputs or dataset slice

- `spirit-warning-errors`
- `low-quality-image`
- targeted unit fixtures for phrase-level diff shaping
- route integration tests for `POST /api/review/warning`

## Pass criteria

- the warning defect case returns `fail`
- the low-quality path returns `review`
- warning evidence exposes the fixed five sub-check IDs and ordered diff segments
- no extra model call is introduced beyond the existing extraction call
