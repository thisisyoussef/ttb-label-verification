# Persona Scorecards

Use these scorecards alongside the endpoint slices. They are release questions, not marketing personas.

## Sarah

- Surfaces: `/api/review`, `/api/review/warning`, batch demos
- Questions:
  - Does the visible outcome stay consistent with the focused route purpose?
  - Does the route fail clearly instead of drifting into ambiguous noise?
  - Does the fixture-backed latency stay comfortably below the local gate?

## Dave

- Surfaces: `/api/review`, `/api/batch/run`
- Questions:
  - Do cosmetic differences stay `review` instead of becoming `reject`?
  - Do route-level guardrails prevent dumb false failures on partial evidence?
  - Does batch keep review-only rows isolated instead of escalating the whole run?

## Jenny

- Surfaces: `/api/review`, `/api/review/extraction`, `/api/review/warning`
- Questions:
  - Are the expected fields present in the extraction payload?
  - Is low confidence preserved explicitly instead of hidden?
  - Does warning evidence identify the failing sub-check instead of only a generic summary?

## Marcus

- Surfaces: all model-backed routes
- Questions:
  - Is every eval fixture-backed or sanitized?
  - Are provider, prompt-profile, and guardrail-policy versions recorded?
  - Do outputs prove `noPersistence` without logging raw submissions?

## Janet

- Surfaces: `/api/batch/run`, `/api/batch/retry`
- Questions:
  - Does each row retain its own status and summary without cross-row contamination?
  - Does retry recover only the targeted errored row?
  - Does the batch summary move predictably from error to recovered status?
