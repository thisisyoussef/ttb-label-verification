# User Flow Map

## Scope

Toolbench sample loading follow-up for `TTB-304`: stabilize the Samples tab while capability probes resolve, and ensure loading a new single-review sample clears stale single-review state before the next intake or processing render.

## Branches

1. Reviewer opens `Toolbench -> Samples`.
   - Initial state: random-sample action is visible immediately.
   - While live/synthetic capability probes are still pending, a reserved placeholder occupies the capability slot so batch/catalog controls do not jump.
   - Settled state: placeholder is replaced by the live section, the synthetic section, both, or neither.

2. Reviewer loads a Toolbench sample while a prior single review already exists.
   - Prior report, failure message, OCR preview, refine state, and forced-failure state are cleared.
   - Intake fields are replaced with the new sample payload.
   - Beverage selection returns to `auto` so the new label does not inherit the previous manual selection.
   - The intake view opens with the new primary/secondary image pair.

3. Reviewer verifies the newly loaded sample.
   - Processing starts from a clean state.
   - OCR preview rows are empty until the new preview frame arrives; no stale values from the prior sample may render.

4. Reviewer loads a Toolbench batch pack.
   - Existing batch behavior is unchanged.

## Manual checks

- Open the Samples tab and confirm the panel does not reflow through intermediate action stacks before the final controls appear.
- Run a single review, then load a different sample from Toolbench and confirm the intake/processing views do not flash old OCR values, old verdict state, or the previous beverage selection.
