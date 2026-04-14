# User Flow Map — TTB-106

## Scope

Guided tour and contextual help for the signed-in workstation. This map is the execution reference for the TTB-106 follow-up hardening work that blocks footer `Next` on action steps instead of silently skipping ahead.

## Guided tour

### Happy path

1. Reviewer opens `Guided tour`.
2. Step 1 orientation: `Next`.
3. Step 2 launcher: `Next`.
4. Step 3 drop zone: reviewer loads a sample or a real label image.
5. Step 4 verify: reviewer clicks the real `Verify Label` button.
6. Processing runs, then results render.
7. Step 5 verdict banner: `Next`.
8. Step 6 warning evidence: reviewer is always taken to the failing warning scenario for this teaching step.
9. Step 7 batch mode: reviewer clicks the real `Batch` tab.
10. Step 8 privacy: `Finish`.

### Branches

- Empty:
  - Step 3 with no image loaded: `Prepare sample` is available and `Next` is disabled.
- Disabled:
  - Step 4 with no image loaded: Verify CTA explains the disabled state and `Next` is disabled.
- Loading:
  - Step 4 after real Verify click: tour stays on the step while the shell moves through `processing`.
- Success:
  - Step 4 advances only after real results render.
- Step 6 simplification:
  - The tour always teaches warning evidence from the deterministic failing warning example instead of branching on the reviewer's current result.
- Failure:
  - Step 4 failed live extraction: deterministic sample results are materialized and the tour advances.
- Retry:
  - Reviewer can rerun the tour from step 1 at any time from the launcher.
- Cancel / close:
  - Reviewer can close the tour from any step without affecting in-flight product state.
- Back:
  - `Previous` stays available on all steps after step 1.
- Reset:
  - `Finish` returns the signed-in shell to blank single-label intake.
- Recovery:
  - Step 3 can recover with `Prepare sample`.
  - Step 5 can recover with `Show sample results`.
  - Step 6 can recover with `Load failing label`.
- Skip-ahead:
  - No footer-button skip-ahead remains on action steps. Recovery is explicit.

## Contextual help

### Happy path

1. Reviewer clicks an `info` anchor.
2. Popover opens with plain-language copy.
3. Reviewer closes with `Close`, outside click, or Escape.

### Branches

- Missing content:
  - Anchor stays disabled with `Help content is on the way.`
- Keyboard:
  - Enter/Space opens; Escape closes; focus returns to the anchor.

## Manual verification targets for this hardening pass

1. Step 3: `Next` is disabled until the label is loaded.
2. Step 4: `Next` is disabled and the tour only advances after the real Verify click resolves.
3. Step 6: `Next` is disabled until the failing warning scenario is loaded and expanded.
4. Step 7: `Next` is disabled until Batch mode is actually open.
