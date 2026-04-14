# Feature Spec

## Story

- Story ID: `TTB-205`

## Goal

Turn extraction plus warning validation into the real single-label review route the approved Results UI consumes.

## Acceptance criteria

1. `/api/review` returns an integrated `VerificationReport`.
2. Submitted application values appear in returned comparison rows.
3. Brand and other cosmetic differences downgrade to `review`.
4. Distilled spirits same-field-of-vision stays advisory unless strong evidence exists.
5. Wine vintage/appellation dependency is enforced.
6. Malt beverage forbidden `ABV` format is enforced.
7. Warning evidence from `TTB-204` is included unchanged in the final report.
8. No-text extraction returns the approved empty-check state.
