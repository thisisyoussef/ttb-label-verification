# Feature Spec

## Story

- Story ID: `TTB-102`
- Title: single-label results, warning evidence, and standalone UI

## Problem statement

Claude froze the results UI, but the runtime path behind it was still misleading in two ways: the client validated the `/api/review` payload and then ignored it in favor of seeded fixtures, and the seed review route could not produce a true standalone result when application fields were omitted. That left the approved UI looking complete while still bypassing the real API boundary it was supposed to prove.

## User-facing outcomes

- The single-label results surface now renders the report returned by `POST /api/review`
- Standalone submissions return a standalone-shaped report from the server seed path
- Dev-only fixture controls remain available for local scenario exercise, but they no longer leak into the normal runtime path by default
- Batch fixture selectors are treated as dev-only controls while the real batch backend remains deferred

## Acceptance criteria

1. The client uses the parsed `VerificationReport` returned by `/api/review` as the default results source
2. Dev-only seeded scenario overrides still work when fixture controls are explicitly enabled
3. Omitted application fields yield a `standalone: true` review report with `not-applicable` comparisons and `info`-level cross-field skips
4. No layout, copy, styling, or interaction changes are introduced in the approved `TTB-102` or `TTB-103` UI surfaces
5. The story packet includes the standard Codex engineering docs for a latency-sensitive visible runtime change

## Edge cases

- fixture mode enabled with a non-blank scenario still forces the seeded scenario payload for local demo work
- fixture mode disabled falls back to the live route payload, even in local development
- omitted application fields without a live report fallback still resolve to the dedicated standalone report shape
- no-text and standalone dev overrides still work without changing the production path

## Out of scope

- the full single-label recommendation aggregator and beverage-rule engine in `TTB-205`
- any new batch API, parser, matcher, orchestration, or export backend work
- frontend redesign of the results surface, batch intake, or batch processing views
