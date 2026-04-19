# Evidence Contract

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Surfaces introduced or changed

- Pure validator: `src/server/government-warning-validator.ts`
- Staging route: `POST /api/review/warning`
- Shared payload shape: `CheckReview.warning` in `src/shared/contracts/review.ts`

## Warning payload rules

- `id` remains `government-warning`
- `warning.subChecks` must always contain the five canonical IDs in canonical order
- `warning.required` is the canonical text from `27 CFR 16.21`
- `warning.extracted` is the normalized extracted warning text
- `warning.segments` walks left-to-right and uses only:
  - `match`
  - `missing`
  - `wrong-character`
  - `wrong-case`

## Comparison semantics

- Exact-text comparison normalizes whitespace only for positional alignment.
- Diff rendering keeps punctuation, character substitutions, and case-only differences explicit in the segment list.
- Warning pass/fail semantics still require exact wording and punctuation, but body-letter case differences alone do not force failure when the wording otherwise matches.
- Missing punctuation may absorb the following matched whitespace into the `missing` segment so the UI stays positionally readable.
- Case-only word defects are grouped at the phrase level when adjacent wrong-case words are separated only by matching spaces.

## Sub-check semantics

- `present`
  - `pass` when warning text is detected
  - `fail` only when the label is readable and the warning still is not detected
  - `review` when presence itself is uncertain
- `exact-text`
  - `pass` when the warning wording and punctuation match after whitespace normalization, even if body letter case differs
  - `fail` for clear wording or punctuation defects
  - `review` when text confidence or image quality is too weak for a hard call
- `uppercase-bold-heading`
  - applies only to the opening `GOVERNMENT WARNING` heading, not the rest of the warning body
  - deterministic failure for visible mixed-case heading text
  - visual boldness uses the extracted `prefixBold` signal and compares the heading against the words immediately after it
  - uncertainty falls back to `review`
- `continuous-paragraph`
  - driven by the extracted `continuousParagraph` signal
- `legibility`
  - covers label readability plus `separate and apart` evidence from `separateFromOtherContent`
  - low image quality or uncertain separation falls back to `review`

## Compatibility notes

- This story does not cut over the full `POST /api/review` response yet.
- The warning route exists to prove the warning evidence contract end to end before `TTB-205` aggregates the full report.
