# Feature Spec

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Problem

`TTB-203` can now extract warning text, image-quality state, and warning-specific visual signals, but the product still lacks the showcase validator that turns those facts into a defendable warning check. The approved results UI already assumes a sub-check list plus a precise diff block, and `TTB-205` depends on this warning output before the full single-label review path can be made real.

## Goals

- Validate the government warning deterministically when text evidence is clear.
- Produce warning evidence that matches the approved TTB-102 UI contract.
- Expose a repeatable warning-only backend surface without cutting over the full review route yet.
- Keep uncertain visual judgments reversible and explicit.

## Non-goals

- Full `POST /api/review` recommendation aggregation
- Non-warning field comparisons
- Beverage-specific rule checks outside the warning
- Client-side design changes

## Acceptance criteria

1. Exact-text comparison works against the canonical warning text from `27 CFR 16.21`.
2. Sub-check output preserves the fixed five-item warning UI contract while covering the CFR formatting requirements from `27 CFR 16.22`.
3. Diff evidence is precise enough to drive the approved warning UI, including `wrong-case`, `wrong-character`, and `missing` segments.
4. Clear text defects fail deterministically; ambiguous visual formatting defects degrade to `review`.
5. The warning-error eval case is caught reliably and the low-quality path remains explicit about uncertainty.
6. The packet, rule mapping, evidence contract, and eval result are updated so `TTB-205` can consume the warning validator without rediscovery.

## User impact

- Reviewers get a defendable warning decision surface instead of a seeded placeholder.
- Engineering gains a stable warning-only staging route and reusable validator for the full review aggregation story.
