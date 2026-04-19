# Observability Plan

## Scope

User-reported state leak and layout-shift follow-up for Toolbench sample loading under `TTB-304`.

## Signals

- Reuse existing sanitized client events for intake image replacement:
  - `review.intake.images-selected`
- Reuse the existing `review.pipeline.state` and processing transitions to confirm the next verification starts from a fresh running state.

## Expected evidence

- Opening the Samples tab should not require new telemetry; the bug is visual layout instability, and the fix is a deterministic placeholder in the capability slot.
- Loading a Toolbench sample should no longer leave stale OCR preview or prior review state visible before the next verification resolves.

## Privacy posture

- No raw label bytes, OCR text dumps, or full application payloads are logged.
- File-level observability remains limited to sanitized filenames, mime types, and sizes already emitted by the intake events.
