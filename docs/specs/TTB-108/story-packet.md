# Story Packet

## Metadata

- Story ID: `TTB-108`
- Title: extraction mode selector and mode-aware processing states
- Parent: `TTB-004`
- Lanes in scope: Claude (UI) + Codex (client wiring and request-state integration)
- Claude lane status: `done` (UI approved 2026-04-14)
- Codex lane status: `ready-for-codex`
- Packet mode: expanded working packet
- Depends on: `TTB-107` approved; Codex integration also depends on `TTB-206` (extraction mode routing) and `TTB-212` (local extraction mode)

## Problem

The current workstation exposes one implicit extraction path. The dual-mode architecture (cloud + local) needs a reviewer-facing selector that defaults to local (deployment-realistic) and lets the reviewer switch to cloud for demos. The control must be present and credible for Marcus (IT gatekeeper) and Sarah (leadership demos) without adding friction for Dave (veteran reviewer).

## Acceptance criteria

1. The auth flow includes a mode-select step after sign-in success, before the workstation loads.
2. Local (on-premise) is the default. Cloud (demo) is the alternative.
3. Each option has a tooltip explaining the deployment rationale grounded in real project constraints.
4. The signed-in header shows a compact mode indicator with a quick-switch link.
5. The processing surface reflects the selected extraction mode in header copy, body copy, and sidebar context.
6. The results surface stays structurally the same regardless of mode.
7. Local-mode framing is calm and explicit: slower, more Review outcomes, no parity promise.
8. Mode selection is tab-scoped React state, reset to local on sign-out.
9. If local mode is unavailable, a bounded failure state appears with a path back to cloud.

## Constitution check

### Claude lane
- UI only. No `src/server/**` or `src/shared/**` edits.
- Build the mode-select auth step, header indicator, processing copy, and unavailable state.

### Codex lane
- Wire extraction mode into the review request body.
- Pass mode to the backend extraction-mode seam (lands in `TTB-206`).
- Replace client-side heuristic for local-unavailable with proper backend error-kind check.
- Add regression tests for cloud/local selection, reset, and unavailable-state recovery.

## Working artifacts

- `docs/specs/TTB-108/ui-component-spec.md` — design spec (v2)
- `docs/backlog/codex-handoffs/TTB-108.md` — Codex handoff (`ready-for-codex`)
- No Stitch refs (claude-direct mode)

## Out of scope

- New result cards or a second evidence model
- Exposing provider names in the reviewer surface
- Settings screens, configuration drawers, or admin panels
- Backend provider implementation (belongs to `TTB-206`, `TTB-207`, `TTB-212`)
