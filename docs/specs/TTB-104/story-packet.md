# Story Packet

## Metadata

- Story ID: `TTB-104`
- Title: batch dashboard, drill-in shell, and export UI
- Parent: `TTB-003`
- Primary lane: Claude
- Packet mode: compact planning packet

## Constitution check

- UI only.
- Must preserve the single-label evidence language inside batch drill-in.
- Must freeze filter, sort, drill-in, and export interactions before Codex begins batch integration.

## Feature spec

### Problem

Batch processing only saves reviewer time if the dashboard helps them work the highest-risk labels first without learning a second interface.

### Acceptance criteria

- Dashboard shows approve/review/reject counts and a sortable triage table.
- Filters work for all, failures, reviews, and approved rows.
- Drill-in shell clearly routes to individual result detail.
- Export is present as a user-facing action even if the implementation remains session-scoped.

## Technical plan

- Reuse the batch intake language from `TTB-103` and the result semantics from `TTB-102`.
- Prepare a Stitch brief centered on triage, density, and drill-in.
- Capture Codex-facing requirements around per-row summary fields, drill-in contract, and export behavior.

## Task breakdown

1. Expand the dashboard-focused UI design spec.
2. Stop for Stitch output and implement against the returned references.
3. Seed filters, sort states, empty states, and drill-in shell behavior.
4. Run the app and stop for visual review.
5. Write the Codex handoff with frozen dashboard rules and backend data requirements.
