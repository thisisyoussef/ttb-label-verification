# Feature Spec

## Story

- Story ID: `TTB-EVAL-001`
- Title: golden eval set foundation and run discipline

## Problem statement

The project documents repeatedly call for disciplined evaluation, but the repo currently only has a six-case starter subset and a thin run-log shape. Without a full golden set, a live image-backed subset, and a slice-based run discipline, prompt changes, validator changes, batch behavior, and error handling will drift without a defensible quality gate.

## User-facing outcomes

- Engineers have a fixed golden set that covers the proof of concept's key scenarios, not only the first six.
- Claude can seed UI states from the same scenarios Codex uses for engineering evaluation.
- Story handoffs can point to concrete eval runs instead of narrative confidence.
- Final project documentation can describe the core six plus the wider golden slices and what each one proves.

## Acceptance criteria

1. The repo contains a canonical golden manifest covering the full 40-case test set plus named slices for applicable runs.
2. The repo contains a live image-backed core-six subset manifest for seeded UI and first-pass live extraction work.
3. Each case records a stable golden identifier, runtime slug where relevant, scenario class, applicability, and expected primary outcome.
4. The repo contains a checked-in eval result format that captures dataset slices, cases run, expected vs actual outcomes, measured latency, blocked live assets, regressions, and follow-up actions.
5. The story queue and workflow docs point later AI, validator, batch, and error-path work at this golden set as a required gate.
6. The corpus guidance explains how to handle missing real assets, swapped assets, additional scenarios, and live-subset promotion without silently changing the baseline.

## Edge cases

- Real label assets are not yet committed when the spec is written; the live subset still needs placeholder paths and scenario ownership.
- Some future evals may be manual rather than automated; the run log still needs to be reproducible.
- A new important failure mode appears before implementation is complete; the golden set should allow extension without silently mutating the core six.

## Out of scope

- Building a fully automated eval runner.
- Implementing extraction or validator logic itself.
