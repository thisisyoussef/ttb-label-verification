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
- The `tour-drop-zone` spotlight target must remain attached in both empty and already-loaded states so the tour can still point at the intake region after a sample is loaded.
- Any other mode/view: explain that the tour needs the single-label intake and offer `Prepare sample`, which restores single intake and loads a safe demo label.
- `Next` stays disabled until intake is actually ready. The reviewer must either load a label manually or use `Prepare sample`.

## Step 4 — Verify Label

- `single` + `intake` + image present: keep click-to-advance on the real button.
- After the real Verify click moves the shell into `processing`, keep the tour on Step 4 until results exist; do not advance on the click event alone.
- If the shell is still visibly on intake for the same click frame, keep waiting; do not clear the pending verify-tour state until results, failure recovery, or an explicit tour exit.
- `single` + `processing` + phase `running`: replace click-to-advance with a waiting message.
- `single` + `processing` + phase `failed`: replace click-to-advance with `Show sample results` so the tour recovers into the results step instead of getting stranded on an error screen.
- `single` + `intake` + no image: remove click-to-advance and offer `Prepare sample`.
- Any other mode/view: remove click-to-advance and offer `Return to intake`.
- `Next` stays disabled for this step. The reviewer must use the real Verify button; failure recovery still auto-loads deterministic sample results only after that real click path has been attempted.

## Step 5 — Verdict and checklist

- `results` + report present: spotlight the verdict banner.
- Any other state: offer `Show sample results` so the tour can continue without a live extractor run.
- `Next` stays disabled until results exist. Recovery comes from the explicit `Show sample results` action, not from skipping ahead with the footer button.

## Step 6 — Warning evidence

- `results` + report present + `spirit-warning-errors` scenario: spotlight the warning row with the row already expanded so the sub-checks and diff are visible.
- Any other results state: offer `Load failing label`.
- No results yet: offer `Load failing label`, which also materializes a safe demo result.
- `Next` stays disabled until the failing warning scenario is active and the warning evidence has been materialized.

## Step 7 — Switch to Batch

- Currently in single mode: keep click-to-advance on the real Batch tab.
- Already in batch mode: remove click-to-advance and explain that batch mode is already active.
- `Next` stays disabled until the real Batch tab has been clicked or batch mode is already active.

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
- On passive steps, `Next` advances immediately.
- On action steps, `Next` is a gate, not a recovery shortcut. The reviewer must complete the required live action or use the explicit recovery button shown in the callout.
- On a real **Verify Label** click, the tour advances only after results exist; if live processing fails during the tour, it auto-recovers into deterministic sample results before moving to the verdict step.
- Real click-to-advance targets keep their direct behavior: clicking the live control still advances the tour without replacing the underlying interaction.
