# Evidence Contract

## Story

- Story ID: `TTB-003`
- Title: batch triage workflow and processing pipeline

## Surfaces affected

- API route or handler: batch intake, batch status, and export endpoints
- Shared contract file: `src/shared/contracts/review.ts` or adjacent batch contract expansion
- UI detail surfaces:
  - batch upload confirmation
  - batch progress
  - batch dashboard
  - single-item drill-in

## Evidence objects

- batch summary:
  - total items
  - approve/review/reject counts
  - in-progress/failed counts
- batch row:
  - identifier
  - brand name or fallback label
  - beverage type
  - top-level recommendation
  - issue count
  - highest severity
  - match state
  - low-confidence flag
- drill-in:
  - full reuse of the single-label evidence payload from `TTB-002`
- export object:
  - flattened row-level output suitable for CSV

## Status and severity semantics

- batch rows use the same recommendation and severity vocabulary as single-label review
- unmatched or failed-processing rows must be explicit and not silently omitted
- low-confidence items remain triage-visible even if the top-level recommendation is `review`

## Payload changes

- Added fields:
  - batch summary and row metadata
  - match status
  - export representation
- Changed fields:
  - none to the single-label drill-in model; reuse is preferred
- Removed fields:
  - none

## Compatibility notes

- The dashboard should be able to render a row without needing the full drill-in payload eagerly.
- Drill-in should not require a second, differently shaped evidence language.
