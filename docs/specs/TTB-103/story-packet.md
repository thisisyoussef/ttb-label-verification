# Story Packet

## Metadata

- Story ID: `TTB-103`
- Title: batch intake, matching review, and progress UI
- Parent: `TTB-003`
- Lanes in scope: Claude (UI) + Codex (engineering via `TTB-301`)
- Lane status:
  - Claude lane: `done` — UI approved 2026-04-13; `docs/backlog/codex-handoffs/TTB-103.md` written and now completed in the Codex lane
  - Codex lane: `done` — story-local shell integration and fixture-control gating are complete; `TTB-301` remains the blocking batch-engine story and is still gated behind `TTB-205` complete and an approved `TTB-104` handoff per the SSOT queue
- Packet mode: expanded working packet
- Last reconciled: 2026-04-13 at the handoff gate, against `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `docs/backlog/codex-handoffs/TTB-103.md`

## Constitution check

### Claude lane (UI)

- UI only. Touch `src/client/**` and `docs/specs/TTB-103/**`. Never edit `src/server/**`, `src/shared/**`, validators, backend tests, or infra.
- Must reuse the single-label visual language from `TTB-101` / `TTB-102`: top identification region, `Single | Batch` toggle, pinned left column pattern, status badge vocabulary (`Pass` / `Review` / `Fail` / `Info`), industrial-precision theme tokens, `Nothing is stored…` privacy anchor.
- Must activate the `Batch` mode on the existing header toggle without inventing a new app shell, sidebar, or analytics-dashboard language.
- Must run the automated Stitch flow before implementation and then stop for user review of the generated refs. Manual Comet Stitch is a fallback only if `STITCH_FLOW_MODE=manual` is explicitly set or local Stitch auth is unavailable.
- Must stop for explicit user visual review before the Codex handoff is written.
- Zero raw hex in `src/client/**` — extend `tailwind.config.js` and `docs/design/INDUSTRIAL_PRECISION_THEME.md` together if a new token is genuinely needed.

### Codex lane (engineering, via `TTB-301`)

- Batch parser, matcher, orchestration, and session export are session-scoped; no durable workflow storage.
- Preserve the approved batch UI without redesigning it. Only edit `src/client/**` to stitch approved UI to live behavior.
- Drill-in reuses the single-label evidence contract from `TTB-201` / `TTB-102`. Do not invent a second evidence schema.
- Codex may take story-local non-blocking integration work from this handoff, but it does not start `TTB-301` on this story alone; the blocking batch-engine story still waits for `TTB-205` complete and an approved `TTB-104` handoff per SSOT.

## Feature spec

### Problem

High-volume reviewers need a batch entry flow that makes filename-to-row matching legible and trustworthy, and shows progress believably — before the backend is live. If reviewers cannot trust the match step, they will not trust the dashboard that follows.

### Acceptance criteria (UI, Claude-owned)

1. Batch intake accepts many label files and one CSV in a single surface.
2. A matching review section is always visible once both uploads exist, and explains filename-first plus order-based fallback in plain language.
3. Matching review surfaces matched pairs, unmatched images, unmatched rows, and ambiguous (multi-candidate) matches as distinct states.
4. The reviewer can resolve ambiguous and unmatched items manually without leaving the surface.
5. Progress view is readable without tiny charts — a bounded progress readout plus a completed-items stream using the established status badge vocabulary.
6. Error states cover malformed CSV, unsupported file type, size-over-limit, ambiguous matches that block start, and partial per-item failure framing during progress.
7. The flow surfaces a clear path into the dashboard (TTB-104 surface) when processing completes; in this story that transition target is a neutral placeholder the user can inspect.
8. Language never implies durable workflow storage or cross-session state.

### Explicitly out of scope for `TTB-103`

- Dashboard, triage table, filters, drill-in shell, export UI — those live in `TTB-104`.
- Batch parser, matcher, orchestration, and export generation — those live in `TTB-301`.
- Shared contract additions for batch progress/summary payloads — Codex will track those against `TTB-201` / `TTB-301`; TTB-103 records the needs in the UI spec.

## Technical plan

- Expand `docs/specs/TTB-103/ui-component-spec.md` with the full upload + matching + processing specification.
- Prepare `docs/specs/TTB-103/stitch-screen-brief.md` for the automated Stitch run (project-default flow).
- Implement the three batch surfaces in `src/client/**` using client-side seeded fixtures built from the six `evals/labels/manifest.json` scenarios.
- Activate the `Single | Batch` toggle in `src/client/App.tsx` so Batch mode renders the new intake/processing surfaces while Single mode behavior is unchanged.
- Keep all batch data client-side until Codex lands `TTB-301`.

## Task breakdown

### Claude lane

1. Reconcile this packet against the SSOT and TTB-102 handoff (this revision).
2. Write `ui-component-spec.md` covering problem, users, flows, IA/layout, states, copy, constraints, backend data needs, frozen constraints, open questions.
3. Write `stitch-screen-brief.md` and stop for the Stitch prep handoff; paste the full brief inline in chat.
4. Implement `BatchUpload`, `MatchingReview`, and `BatchProcessing` surfaces in `src/client/**` against the returned Stitch references.
5. Seed six-label batch fixtures plus error-state fixtures.
6. Start the dev server in Comet, verify all states, stop for visual review.
7. After approval, write `docs/backlog/codex-handoffs/TTB-103.md` and update SSOT.

### Codex lane (tracked here for scope clarity; executed under `TTB-301` when unblocked)

1. CSV parsing + filename-first / order-based matching, with typed ambiguous and unmatched outputs.
2. Session-scoped batch orchestration with bounded concurrency.
3. Progress and partial-result shaping consistent with the UI contract captured here.
4. Reuse the single-label evidence model for per-row detail.
5. Privacy: no durable storage of images, CSV rows, matched identity, or results.

## Working artifacts

- `docs/specs/TTB-103/story-packet.md` — this file (expanded packet).
- `docs/specs/TTB-103/ui-component-spec.md` — per-feature UI implementation spec.
- `docs/specs/TTB-103/stitch-screen-brief.md` — Stitch brief + returned-reference record, including the 26 normalized deviations logged in §8.
- `docs/specs/TTB-103/stitch-refs/automated/2026-04-13T21-24-00-387Z/` — generated Stitch HTML + screenshot manifest.
- `docs/backlog/codex-handoffs/TTB-103.md` — completed Codex handoff with frozen UI constraints and remaining `TTB-301` backend contract notes.
- Shared baseline: `docs/specs/TTB-003/ui-component-spec.md`, `docs/specs/TTB-003/stitch-screen-brief.md`, `docs/backlog/codex-handoffs/TTB-102.md`, `src/shared/contracts/review.ts`, `docs/design/MASTER_DESIGN.md`, `docs/design/INDUSTRIAL_PRECISION_THEME.md`, `evals/labels/manifest.json`.

## Reconciliation notes

### Expand gate (2026-04-13, packet expansion before UI implementation)

- Original compact packet stated `UI only` as the full constitution check. Rewritten lane-scoped because `TTB-003` has an engineering sibling (`TTB-301`); `TTB-103`'s approved UI is an input to that later engineering work, so both lanes are named here even though Codex cannot start yet.
- Lane status reflected SSOT at expand time: Claude `in-progress`, Codex `blocked-by-dependency`.
- Scope is sharpened to intake + matching + progress. The dashboard + drill-in + export sit under `TTB-104`; capturing them here would overlap the next Claude story.

### Handoff gate (2026-04-13, Codex handoff written)

- Claude lane marked `done`; UI approved after a two-round refinement pass (structured CSV row display, image preview overlay, CSV headers panel).
- At handoff time, the Codex lane was `ready-parallel` because this story had executable non-blocking integration work. That story-local Codex handoff work is now complete, while SSOT still requires `TTB-205` complete and an approved `TTB-104` handoff before `TTB-301` can begin as the blocking batch-engine story.
- Working-artifacts list updated to point at the finalized Stitch run directory and the written handoff doc.
- 2026-04-13 Codex completion pass: the approved batch shell stays mounted while dev-only batch seed controls are gated behind fixture-mode rules.
- No constitution-check changes were needed at this gate.
