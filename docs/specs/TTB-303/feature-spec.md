# Feature Spec

## Story

- Story ID: `TTB-303`
- Title: batch input append and toolbench mode-routing regression fix

## Problem

The live-first batch flow is in place, but two input behaviors are still wrong:

1. choosing more images from the batch image picker replaces the current batch instead of appending
2. loading a label image from the toolbench while batch is active sends the user back to single review

These are workflow regressions because they break batch intake continuity and make the toolbench unreliable during batch review setup.

## Acceptance criteria

1. The batch image drop zone appends newly selected images when the reviewer uses `Add more`.
2. Batch image drag/drop from the toolbench appends into the active batch intake instead of replacing unrelated state unless replacement is explicitly intended.
3. Loading a label image directly from the toolbench respects the active mode:
   - in single mode, it loads into single review
   - in batch mode, it loads into the active batch intake
4. Loading a CSV directly from the toolbench while batch is active continues to target batch.
5. The fix does not reintroduce fixture-first batch routing or break live preflight.

## Out of scope

- New batch matching logic
- New toolbench UI concepts
- Broader batch workflow redesign
