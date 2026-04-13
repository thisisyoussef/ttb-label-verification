# Evidence Contract

## Story

- Story ID: `TTB-002`
- Title: single-label compliance engine and recommendation API

## Surfaces affected

- API route or handler: `POST /api/review`
- Shared contract file: `src/shared/contracts/review.ts`
- UI detail surfaces:
  - recommendation banner
  - count summary
  - checklist rows
  - expandable row details
  - government warning detail
  - cross-field checks
  - standalone mode

## Evidence objects

- application value:
  - raw value as entered or normalized display value
- extracted value:
  - field-specific extracted text or normalized output
- confidence:
  - numeric confidence for extraction or visual judgment
  - optional qualitative note when the confidence is low enough to justify `review`
- citations:
  - authoritative rule references that justify the check
- diff or comparison object:
  - warning canonical text vs extracted text diff payload
  - field comparison metadata for fuzzy/cosmetic differences
- cross-field evidence:
  - dependency checks such as imported-country, wine vintage/appellation, varietal totals, and spirits same-field-of-vision

## Status and severity semantics

- pass:
  - clear compliant or matching result
- review:
  - likely acceptable but needs human judgment, or evidence confidence is not strong enough for `pass`
- fail:
  - clear violation or mismatch with strong evidence
- uncertainty fallback:
  - any ambiguous visual judgment that cannot be defended deterministically or with strong extraction confidence must return `review`

## Payload changes

- Added fields:
  - application value
  - extracted value
  - explanation text
  - citation objects or strings
  - warning sub-checks
  - warning diff payload
  - cross-field checks
  - image-quality or low-confidence signals
  - mode metadata for standalone vs comparison
- Changed fields:
  - field rows move from seed summary-only objects to UI-complete evidence objects
- Removed fields:
  - none expected; seed compatibility should be preserved until integration cutover

## Compatibility notes

- Preserve the top-level recommendation and ordered checklist model from `TTB-001`.
- Standalone mode must suppress application comparison language without requiring a second endpoint.
- The response model should remain serializable without storing or replaying the uploaded asset after the request completes.
