# Eval Brief

## Story

- Story ID: `TTB-211`
- Title: LLM endpoint and mode eval matrix, persona scorecards, and trace regression gates

## Evaluation behavior being changed

This story changes how the repo evaluates model-backed behavior rather than changing the extraction runtime directly.

## Expected gain

- route-specific regressions are caught earlier
- persona expectations become explicit, reviewable product constraints
- trace evidence becomes comparable across provider and prompt changes

## Failure modes to catch

- review route passes generic extraction checks but regresses Dave-sensitive trust behavior
- warning route regresses the showcase warning fidelity without failing the generic corpus gate
- batch route instability is missed because single-label evals still pass
- persona scorecards remain too vague to drive a release decision
- eval and trace artifacts leak more prompt or payload detail than the runtime privacy posture allows

## Eval inputs or dataset slice

- the existing smallest-applicable golden slices
- one route-oriented dry run per current model-backed endpoint
- one recorded example using the updated run template

## Pass criteria

- endpoint matrix and persona scorecards are checked in
- eval templates and docs are synchronized
- trace guidance records endpoint and prompt-profile identity
- `TTB-401` explicitly depends on the new endpoint-aware evidence
