# Constitution Check

## Story

- Story ID: `TTB-302`
- Title: live-first batch runtime, workflow cleanup, and fixture demotion
- Parent: `TTB-003`
- Primary lane: Codex

## Scope classification

- Codex-only engineering story that refines approved batch UI surfaces without redesigning them.
- Visible runtime behavior changes are in scope because the current batch client is still fixture-centered.

## Non-negotiable constraints

1. Batch uploads, CSV rows, results, and exports remain session-scoped and in memory only.
2. The approved `TTB-103` and `TTB-104` UI direction is frozen; this story may refine state flow and copy but not replace the shell design.
3. The batch dashboard and drill-in continue to reuse the single-label evidence contract rather than inventing a second result model.
4. Fixtures may remain for dev/demo support, but they must become explicitly gated and must not define the primary live workflow model.
5. If a behavior change affects batch view states or anchors, dependent help surfaces must be reviewed and updated.

## Why this story exists

`TTB-301` proved that live batch processing, summary fetches, report drill-in, retry, and export exist. The remaining product problem is architectural and experiential: the client runtime still initializes and branches around seeded scenarios as the default mental model, which makes the batch feature feel demo-driven even when the server path is real.

This story finishes the batch feature as a reviewer-credible workflow by making live mode primary, reducing fixture leakage into the main state model, and tightening the end-to-end runtime behavior without broad UI redesign.
