# Feature Spec

## Problem

The approved `TTB-102` results UI expects a much richer review payload than the current scaffold contract exposes. Until the shared contract is expanded, the UI can only render seeded client-side fixtures and cannot safely converge on one report model for later engineering stories.

## Goals

- Define one shared review report shape that covers the approved verdict banner, counts, checklist rows, warning evidence, comparison evidence, cross-field checks, and extraction-quality states.
- Keep the seed report valid against that richer schema so the server can continue returning a typed scaffold payload during later story work.
- Align contract terminology with the approved UI vocabulary: `verdict`, `counts`, `check status`, `standalone`, and `extractionQuality`.

## Non-goals

- Implement live extraction or deterministic validator behavior.
- Change the visible results UI.
- Add persistence, exports, or new endpoints.

## Acceptance criteria

1. `verificationReportSchema` supports the TTB-102 evidence model, including warning sub-checks, diff segments, comparison evidence, cross-field checks, and standalone/no-text states.
2. The seed verification report parses against the expanded schema and exercises the major evidence surfaces.
3. Contract tests explicitly cover standalone comparison skips and no-text-extracted reports.
4. The client-facing type boundary no longer contradicts the shared contract for the TTB-102 report model.

## User impact

- No visible UI redesign in this story.
- The shared contract becomes stable enough for later stories to drive the approved results surface with live data instead of client-only fixtures.
