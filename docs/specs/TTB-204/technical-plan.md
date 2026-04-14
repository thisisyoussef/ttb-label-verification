# Technical Plan

## Scope

Implement the government warning validator, phrase-level diff shaping, and a warning-only staging route.

## Planned modules

- `src/shared/contracts/review.ts`
  - export the canonical government warning text for shared server use
- `src/server/government-warning-validator.ts`
  - normalize warning text
  - generate phrase-level diff segments
  - map extraction + visual signals into the five approved warning sub-checks
  - build the final `CheckReview` payload for the warning row
- `src/server/index.ts`
  - expose `POST /api/review/warning` as a staging route that runs intake -> extraction -> warning validation
- `src/server/index.test.ts`
  - prove the warning route returns the shared `CheckReview` contract

## Design choices

- Whitespace is normalized before exact-text comparison so OCR line breaks do not create fake failures.
- Text defects remain deterministic when the warning read is clear.
- Visual checks use the existing `warningSignals` extraction surface and stay conservative:
  - high-confidence `yes` -> `pass`
  - high-confidence `no` -> `fail`
  - `uncertain` or low-confidence -> `review`
- `legibility` carries the approved UI slot for readability plus the CFR `separate and apart` requirement.

## Risks and fallback

- Risk: diff output over-groups case changes and becomes hard to read.
  - Fallback: keep token-level alignment and only merge wrong-case words across matching spaces.
- Risk: extraction quality is too weak for a hard exact-text decision.
  - Fallback: keep `present` pass when text is detected, but downgrade `exact-text` and visual formatting checks to `review`.
- Risk: a warning-only route drifts from the future full review path.
  - Fallback: keep the validator pure and let the route be a thin seam over the reusable module.
