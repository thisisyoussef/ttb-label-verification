# Tour Logic Branches

This file records the meaningful runtime branches for the `TTB-106` guided tour so the flow does not assume the happy path.

## Step 1 — Orientation

- Any state: passive intro, always `Next`.

## Step 2 — Launcher

- Signed-in shell visible: spotlight the launcher.
- Target not visible: centered callout with the generic target-missing note.

## Step 3 — Drop a label image

- `single` + `intake` + no image: show `Prepare sample`.
- `single` + `intake` + image present: explain that intake is already ready and allow `Next`.
- Any other mode/view: explain that the tour needs the single-label intake and offer `Prepare sample`, which restores single intake and loads a safe demo label.

## Step 4 — Verify Label

- `single` + `intake` + image present: keep click-to-advance on the real button.
- After the real Verify click moves the shell into `processing`, keep the tour on Step 4 until results exist; do not advance on the click event alone.
- `single` + `processing` + phase `running`: replace click-to-advance with a waiting message.
- `single` + `processing` + phase `failed`: replace click-to-advance with `Show sample results` so the tour recovers into the results step instead of getting stranded on an error screen.
- `single` + `intake` + no image: remove click-to-advance and offer `Prepare sample`.
- Any other mode/view: remove click-to-advance and offer `Return to intake`.

## Step 5 — Verdict and checklist

- `results` + report present: spotlight the verdict banner.
- Any other state: offer `Show sample results` so the tour can continue without a live extractor run.

## Step 6 — Warning evidence

- `results` + report present + `spirit-warning-errors` scenario: spotlight the warning row.
- Any other results state: offer `Show warning defect`.
- No results yet: offer `Show warning defect`, which also materializes a safe demo result.

## Step 7 — Switch to Batch

- Currently in single mode: keep click-to-advance on the real Batch tab.
- Already in batch mode: remove click-to-advance and explain that batch mode is already active.

## Step 8 — Nothing is stored

- Any state: passive finish step.
- `Finish` closes the tour and resets the shell to signed-in single-label intake with blank fields and no image loaded.

## Demo-path rules

- Tour recovery actions never require a live extractor.
- `Prepare sample` loads a deterministic demo image and sample intake values.
- Results-recovery actions materialize deterministic demo reports for the requested scenario.
- Demo preview URLs use data URIs, so cleanup only revokes real `blob:` URLs.

## Next-button rules

- `Next` is state-aware, not a blind step increment.
- When the current step is already satisfied, `Next` advances normally.
- On **Drop a label image**, `Next` auto-runs `Prepare sample` before advancing when intake is not ready.
- On **Verify Label**, `Next` is a skip-ahead control: it materializes deterministic sample results for the current scenario (or the default happy-path sample) and then advances.
- On a real **Verify Label** click, the tour advances only after results exist; if live processing fails during the tour, it auto-recovers into deterministic sample results before moving to the verdict step.
- On **Verdict and checklist**, `Next` materializes sample results when the reviewer skipped the live run.
- On **Warning evidence**, `Next` materializes the warning-defect scenario when the current results are not the failing case.
- On **Switch to Batch**, `Next` switches the shell to Batch intake when the reviewer has not clicked the Batch tab.
- Real click-to-advance targets keep their direct behavior: clicking the live control still advances the tour without replacing the underlying interaction.
