# Constitution Check

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Lane and ownership

- Codex-only engineering story.
- No frontend layout, copy, or interaction redesign is allowed in this story.

## Invariants

- Reuse the typed extraction payload from `TTB-203`; do not widen the model prompt or ask the model for holistic compliance.
- Keep text comparison deterministic when readable text is available.
- Degrade ambiguous boldness, continuity, legibility, or separation judgments to `review`.
- Preserve the approved warning sub-check order:
  - `present`
  - `exact-text`
  - `uppercase-bold-heading`
  - `continuous-paragraph`
  - `legibility`
- Keep request handling ephemeral and preserve the existing Responses API `store: false` path.

## Story-specific notes

- `legibility` remains the approved fifth UI slot. In this story it carries both readability and the CFR `separate and apart` requirement because the frontend contract is frozen at five warning sub-checks.
- The new staging surface may expose warning-only evidence, but the full `POST /api/review` aggregation cutover remains owned by `TTB-205`.
