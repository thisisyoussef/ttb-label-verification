# Feature Spec

## Story

- Story ID: `TTB-002`
- Title: single-label compliance engine and recommendation API

## Problem statement

The project currently has a scaffold-only health endpoint and seed review payload. To deliver the proof of concept, the backend must accept a real label and optional application data, extract structured facts, run deterministic validation, and return the complete evidence-rich result model the UI needs without persisting sensitive data or blowing the latency budget.

## User-facing outcomes

- A reviewer can submit a label and optional application data and receive a real result instead of a seed fixture.
- The backend returns a recommendation, status counts, field-level evidence, government warning detail, cross-field checks, and image-quality/uncertainty signals.
- Cosmetic differences downgrade to `review` instead of overfiring `fail`.
- Uncertain visual judgments remain explicit `review` states rather than false certainty.

## Acceptance criteria

1. The API accepts the supported single-label file formats and optional application data, with strict file-type and size validation.
2. The extraction pipeline returns a typed structure for the label, including beverage-type-aware fields and confidence signals.
3. Beverage type is taken from the application when provided, otherwise inferred from extracted content with a documented fallback policy.
4. Deterministic validators cover government warning exactness/format, required-field presence, format compliance, fuzzy match handling, beverage-specific rules, and cross-field dependency rules relevant to the proof of concept.
5. The backend returns a complete evidence payload aligned to the approved single-label UI, including warning sub-checks, diff evidence, cross-field checks, citations, and reviewer-facing explanations.
6. Overall recommendation is derived from severity and rule outcomes, not from unconstrained model judgment.
7. The story is evaluated against the six-label corpus with expected outcomes recorded in an eval run.
8. Measured single-label performance stays within the 5-second target and the privacy checklist is satisfied.

## Edge cases

- No application data is provided; the system runs standalone mode without comparison fields.
- The label is blurry, angled, partially cut off, or low quality; extraction confidence and recommendation downgrade appropriately.
- Same-field-of-vision and boldness judgments are uncertain; the response stays explicit about uncertainty and returns `review`.
- A field is missing from the label; the result reports absence rather than inventing a value.
- A brand mismatch is cosmetic only; the system returns `review`, not `fail`.

## Out of scope

- Direct COLAs Online integration.
- Long-lived storage, audit trail persistence, or background workflows.
- Production-grade support for every beverage subtype beyond the proof-of-concept rule set.
