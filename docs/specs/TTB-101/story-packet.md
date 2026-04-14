# Story Packet

## Metadata

- Story ID: `TTB-101`
- Title: single-label intake and processing UI
- Parent: `TTB-001`
- Lanes in scope: Claude (UI) + Codex (engineering)
- Claude lane status: `done` (UI approved 2026-04-13)
- Codex lane status: `ready-for-codex` (see `docs/backlog/codex-handoffs/TTB-101.md`)
- Packet mode: compact planning packet, expanded during active implementation

## Working artifacts

- `ui-component-spec.md` — Claude's UI design spec (intake + processing).
- `stitch-screen-brief.md` — Stitch prompt + returned references in §8.
- `stitch-refs/` — four returned HTML artifacts (intake initial, intake populated wine, processing active, processing failure).
- `../../backlog/codex-handoffs/TTB-101.md` — engineering handoff with frozen constraints, backend needs, and open questions for Codex.

## Constitution check

The story has two lanes. Rules below are lane-scoped, not story-scoped — do not read "UI only" as meaning the story has no engineering scope.

**Claude (UI) lane:**

- UI only. No `src/server/**` or `src/shared/**` edits.
- Must prepare and use `stitch-screen-brief.md`.
- Must seed states from the six-label eval scenarios where relevant.
- Must stop for visual review before writing the Codex handoff.
- Must produce `docs/backlog/codex-handoffs/TTB-101.md` at handoff, listing frozen UI constraints and backend needs.

**Codex (engineering) lane:**

- Must treat the approved UI as fixed input. No `src/client/**` edits.
- Must preserve the frozen constraints listed in the Codex handoff.
- Must answer the open engineering questions in the handoff before implementation (streaming transport, day-one file formats, auto-detect semantics, country field, varietal total, dev controls).
- Codex work for this story lands through the `TTB-201` → `TTB-202` → `TTB-203` → `TTB-204` → `TTB-205` engineering wave behind `TTB-001`; this packet is the shared context, not a parallel engineering spec.

## Feature spec

### Problem

The product needs a clear first-run screen and a believable processing state before the reviewer can trust the rest of the flow.

### Acceptance criteria

- Intake includes upload, optional application data, beverage-specific conditional fields, and a clear primary action.
- Missing image, invalid file type, and oversized file states are explicit.
- Processing view shows image confirmation and multi-step progress.
- The design is large-text friendly, keyboard reachable, and consistent with the workstation visual baseline.
- When Codex wires live behavior behind the approved UI, the behavior matches the frozen constraints in the handoff and the shared contract in `src/shared/contracts/review.ts`.

## Technical plan

- UI implementation surfaces: `src/client/**` (shell, intake, processing, drop zone, beverage-type control, varietals table, scenario picker, seeded scenarios).
- Engineering implementation surfaces (Codex): `src/server/**` for `POST /api/review`, `src/shared/contracts/**` for request/response + error discriminated union, plus the extraction and validator wave in TTB-202 through TTB-205.
- Theme tokens: `docs/design/INDUSTRIAL_PRECISION_THEME.md` → `tailwind.config.js`; no raw hex in `src/client/**`.
- Backend needs surfaced from the UI lane are recorded in the Codex handoff, not in this packet.

## Task breakdown

1. **Claude — UI spec & Stitch prep.** Expand the packet with `ui-component-spec.md` and `stitch-screen-brief.md`. Stop for the user to run Google Stitch. _(done)_
2. **Claude — implement from Stitch refs.** Build `src/client/**` with seeded fixtures covering all six eval scenarios. _(done)_
3. **Claude — visual review.** Start the dev server, hand off for user visual review, incorporate changes, get approval. _(done, approved 2026-04-13)_
4. **Claude — Codex handoff.** Write `docs/backlog/codex-handoffs/TTB-101.md`; update SSOT; reconcile this packet with reality. _(done)_
5. **Codex — engineering wave.** Pick up `TTB-201` first (shared contract expansion), then `TTB-202` through `TTB-205` per the dependency chain. Preserve frozen UI constraints. Answer the open questions in the handoff before implementation. _(ready)_
6. **Codex — verification gates.** `npm run test`, `npm run typecheck`, `npm run build`; privacy checklist; performance budget; update SSOT on status change. _(ready)_
