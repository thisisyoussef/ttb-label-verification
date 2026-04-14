# Evidence Contract

## Top-level report

`VerificationReport` must expose:

- `id`
- `mode`
- `beverageType`
- `verdict`
- `verdictSecondary?`
- `standalone`
- `extractionQuality`
- `counts`
- `checks`
- `crossFieldChecks`
- `latencyBudgetMs`
- `noPersistence`
- `summary`

## Enums

- `verdict`: `approve | review | reject`
- `check status`: `pass | review | fail | info`
- `severity`: `blocker | major | minor | note`
- `extractionQuality.state`: `ok | low-confidence | no-text-extracted`
- `comparison.status`: `match | case-mismatch | value-mismatch | not-applicable`
- `warning sub-check ids` in canonical order:
  1. `present`
  2. `exact-text`
  3. `uppercase-bold-heading`
  4. `continuous-paragraph`
  5. `legibility`
- `diff segment kind`: `match | missing | wrong-character | wrong-case`

## Row model

Every checklist row and cross-field row shares the same `CheckReview` shape:

- `id`
- `label`
- `status`
- `severity`
- `summary`
- `details`
- `confidence`
- `citations`
- `applicationValue?`
- `extractedValue?`
- `comparison?`
- `warning?`

## Warning evidence

`warning` appears on the government warning row and includes:

- `subChecks`: all five canonical sub-check ids in canonical order
- `required`: canonical warning text
- `extracted`: extracted warning text
- `segments`: server-aligned diff segments

## Standalone and no-text

- `standalone: true` removes application-side assumptions from the report contract.
- `comparison.status === 'not-applicable'` is the contract way to represent a skipped comparison.
- `extractionQuality.state === 'no-text-extracted'` allows empty `checks`, zero counts, and an informational report shell without a request-level error.
