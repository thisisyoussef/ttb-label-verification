# Constitution Check

## Story

- Story ID: `TTB-211`
- Title: LLM endpoint and mode eval matrix, persona scorecards, and trace regression gates
- Lane: Codex-only

## Non-negotiables

- Eval and trace artifacts must remain privacy-safe and use only approved fixtures or sanitized inputs.
- Every current model-backed endpoint must be covered:
  - `/api/review`
  - `/api/review/extraction`
  - `/api/review/warning`
  - batch item processing through batch run and retry
- Persona expectations must be explicit. This story cannot reduce evaluation to generic accuracy alone.
- The approved UI and current shared contracts remain fixed.

## Lane-specific scope

- In scope: eval manifest design, endpoint matrix, persona scorecards, run templates, trace metadata requirements, and release-gate wiring.
- Out of scope: UI changes, new provider integrations, and deterministic compliance-rule changes.
