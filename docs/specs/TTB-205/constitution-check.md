# Constitution Check

## Story

- Story ID: `TTB-205`
- Title: field comparison, beverage rules, cross-field checks, and recommendation aggregation

## Lane

- Codex-only engineering story.

## Boundaries

- Allowed: `src/server/**`, `src/shared/**`, tests, packet docs, SSOT, memory files.
- `src/client/**` only if a narrow integration-wiring change is required without redesign.
- Forbidden: layout, copy, or styling changes to approved UI.

## Non-negotiables

- `POST /api/review` must stop being a scaffold-only seed path.
- Verdicts are deterministic, not model-decided.
- Cosmetic mismatches stay `review`.
- No persistence, no raw sensitive logging, `store: false`.
