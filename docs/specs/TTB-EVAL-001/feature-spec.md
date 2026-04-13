# Feature Spec

## Story

- Story ID: `TTB-EVAL-001`
- Title: six-label eval corpus and run discipline

## Problem statement

The project documents repeatedly call for a six-label test corpus and disciplined evaluation, but the repo currently only has the harness shape. Without a stable corpus and run-log format, prompt changes, validator changes, and recommendation changes will drift without a defensible quality gate.

## User-facing outcomes

- Engineers have a fixed baseline corpus that covers the proof of concept's key scenarios.
- Claude can seed UI states from the same scenarios Codex uses for engineering evaluation.
- Story handoffs can point to concrete eval runs instead of narrative confidence.
- Final project documentation can describe the six labels and what each one proves.

## Acceptance criteria

1. The repo contains a canonical six-label corpus manifest covering the baseline happy path, warning defect, cosmetic brand mismatch, wine dependency failure, forbidden beer ABV format, and low-quality image scenario.
2. Each case records a stable identifier, intended asset path, beverage type, scenario description, and expected top-level recommendation.
3. The repo contains a checked-in eval result format that captures cases run, expected vs actual outcomes, measured latency, regressions, and follow-up actions.
4. The story queue and workflow docs point later AI and validator work at this corpus as a required gate.
5. The corpus guidance explains how to handle missing real assets, swapped assets, or additional scenarios without silently changing the baseline.

## Edge cases

- Real label assets are not yet committed when the spec is written; the manifest still needs placeholder paths and scenario ownership.
- Some future evals may be manual rather than automated; the run log still needs to be reproducible.
- A new important failure mode appears before implementation is complete; the queue should allow a corpus extension without mutating the original six scenarios silently.

## Out of scope

- Building a fully automated eval runner.
- Expanding the corpus beyond the six baseline cases.
- Implementing extraction or validator logic itself.
