# Story Packet

## Metadata

- Story ID: `TTB-104`
- Title: batch dashboard, drill-in shell, and export UI
- Parent: `TTB-003`
- Lanes in scope: Claude (UI) + Codex (engineering via `TTB-301`)
- Lane status:
  - Claude lane: `done` — UI approved 2026-04-13; `docs/backlog/codex-handoffs/TTB-104.md` written as `ready-for-codex`
  - Codex lane: `blocked-by-dependency` — `TTB-301` still requires `TTB-205` complete as its second gate; this story's approved handoff cleared the first gate
- Packet mode: expanded working packet
- Last reconciled: 2026-04-13 at the handoff gate, against `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/backlog/codex-handoffs/TTB-102.md`, `docs/backlog/codex-handoffs/TTB-103.md`, and `docs/backlog/codex-handoffs/TTB-104.md`

## Constitution check

### Claude lane (UI)

- UI only. Touch `src/client/**` and `docs/specs/TTB-104/**`. Never edit `src/server/**`, `src/shared/**`, validators, backend tests, or infra.
- Must preserve the single-label evidence language from `TTB-102` inside batch drill-in: verdict banner, field checklist, warning evidence, cross-field checks, comparison blocks, status vocabulary, action bar. Drill-in is a reuse, not a redesign.
- Must preserve the approved `TTB-103` batch intake + processing UI: shell continuity, `Single | Batch` header toggle, privacy anchor, status badge vocabulary, `Pass` / `Review` / `Fail` / `Error` wording, `Open Dashboard →` action from terminal summaries — now routes to this dashboard instead of the placeholder alert.
- Must freeze filter, sort, drill-in, and export interactions before Codex begins `TTB-301` batch integration.
- Must run the automated Stitch flow before implementation and then stop for user review of the generated refs. Manual Comet Stitch is a fallback only if `STITCH_FLOW_MODE=manual` is explicitly set or local Stitch auth is unavailable.
- Must stop for explicit user visual review before the Codex handoff is written.
- Zero raw hex in `src/client/**` — extend `tailwind.config.js` and `docs/design/INDUSTRIAL_PRECISION_THEME.md` together if a new token is genuinely needed. The existing exception in `src/client/labelThumbnail.ts` (SVG image content, not UI tokens) may continue to be used here for drill-in row thumbnails.

### Codex lane (engineering, via `TTB-301`)

- Batch parser, matcher, orchestration, and session export are session-scoped; no durable workflow storage.
- Dashboard rows reuse the single-label evidence contract (`TTB-201`). Do not invent a parallel evidence schema. Drill-in fetches a full `VerificationReport` by `reportId` from an ephemeral in-memory store.
- Preserve the approved batch dashboard, drill-in shell, and export UI without redesigning them. Only edit `src/client/**` to stitch approved UI to live behavior.
- Codex starts `TTB-301` once two gates clear together: `TTB-205` complete + this story's handoff marked `ready-for-codex`.

## Feature spec

### Problem

Batch processing only saves reviewer time if the dashboard helps reviewers work the highest-risk labels first, drill into the same evidence they trust from single-label review, and export the session's outcomes for handoff — without learning a second interface.

### Acceptance criteria (UI, Claude-owned)

1. Dashboard shows approve / review / reject summary counts as the opening signal.
2. Triage table is sortable and filterable (at minimum: `All` / `Rejects only` / `Reviews only` / `Approves only`).
3. Default sort surfaces the worst-first ordering (rejects → reviews → approves, and blocker severity above lower severity within a status group).
4. Each row carries enough identity (thumbnail, filename, brand, class/type, beverage type, issue count, confidence) for the reviewer to triage without opening detail.
5. Drill-in from a row opens the approved `TTB-102` Results view for that specific label inside the same shell — no new evidence language.
6. The reviewer can return from drill-in to the dashboard without losing the current filter or sort.
7. Export is present as a user-facing action that produces a single downloadable session artifact (default: JSON containing the full dashboard + every row's `VerificationReport`).
8. Dashboard and drill-in visibly carry the privacy anchor; the export affordance carries the same assurance before and after download.
9. Empty states cover: dashboard with zero rows after filtering, dashboard for a cancelled batch with only partial completions, drill-in failure (the row's report is unavailable), and export failure.
10. `Open Dashboard →` from the `TTB-103` batch-processing terminal summary now routes to this dashboard view instead of the placeholder alert.

### Explicitly out of scope for `TTB-104`

- Batch parser, matcher, orchestration, session export server — `TTB-301`.
- Accessibility polish, trust copy, and final UI polish — `TTB-105`.
- Cross-session persistence, assignment tracking, review notes — out of scope for the proof of concept.
- Changes to the single-label Results evidence model — that contract is frozen by `TTB-102` and extended only via `TTB-201`.

## Technical plan

- Expand `docs/specs/TTB-104/ui-component-spec.md` with the full dashboard + drill-in shell + export specification.
- Prepare `docs/specs/TTB-104/stitch-screen-brief.md` for a user-reviewed automated Stitch run (default flow; `STITCH_FLOW_MODE=automated` is already set for this workspace).
- Implement `BatchDashboard`, `BatchResultShell` (drill-in wrapper around `Results`), and `BatchExport` affordances in `src/client/**`.
- Extend `batchScenarios.ts` with seed dashboards derived from the existing stream seeds (mixed / all-pass / all-fail / cancelled-partial), plus filter / sort / empty-filter / drill-in / export-error demo seeds.
- Wire the `Open Dashboard →` action from `BatchProcessing.tsx` terminal summary to route here (replacing the placeholder `window.alert`).
- Keep all dashboard data client-side until Codex lands `TTB-301`.

## Task breakdown

### Claude lane

1. Reconcile this packet against the SSOT and the `TTB-103` handoff (this revision).
2. Write `ui-component-spec.md` covering problem, users, flows, IA/layout, states, copy, constraints, backend data needs, frozen constraints, open questions.
3. Write `stitch-screen-brief.md` and run automated Stitch; record returned refs in §8 and stop for user review.
4. Implement `BatchDashboard` + drill-in routing + export UI in `src/client/**` against the approved Stitch references. Wire the `TTB-103` `Open Dashboard →` action to this view.
5. Seed dashboard fixtures (terminal-mixed, all-pass, all-fail, cancelled-partial, plus filter and drill-in demo states).
6. Start the dev server, verify all states in Comet, stop for visual review.
7. After approval, write `docs/backlog/codex-handoffs/TTB-104.md` and update SSOT.

### Codex lane (tracked here for scope clarity; executed under `TTB-301` when both its gates clear)

1. Batch session result store (in-memory, ephemeral): per-row summary + full `VerificationReport` keyed by `reportId`.
2. `GET /api/batch/:batchSessionId/summary` returning the dashboard payload (summary counts + row list).
3. `GET /api/batch/:batchSessionId/report/:reportId` returning the single-label `VerificationReport` for drill-in.
4. `GET /api/batch/:batchSessionId/export` returning the session artifact (JSON) without persisting it; headers + stream only.
5. Privacy: no durable storage of images, rows, results, or exports; session state discarded on batch end or reviewer leave.

## Working artifacts

- `docs/specs/TTB-104/story-packet.md` — this file (expanded packet).
- `docs/specs/TTB-104/ui-component-spec.md` — per-feature UI implementation spec.
- `docs/specs/TTB-104/stitch-screen-brief.md` — Stitch brief + returned-reference record.
- `docs/specs/TTB-104/stitch-refs/` — to be created on Stitch return.
- `docs/backlog/codex-handoffs/TTB-104.md` — to be created after UI approval.
- Shared baseline: `docs/specs/TTB-003/ui-component-spec.md`, `docs/backlog/codex-handoffs/TTB-102.md` (single-label evidence contract), `docs/backlog/codex-handoffs/TTB-103.md` (batch intake + processing continuity), `src/shared/contracts/review.ts`, `docs/design/MASTER_DESIGN.md`, `docs/design/INDUSTRIAL_PRECISION_THEME.md`, `evals/labels/manifest.json`.

## Reconciliation notes (2026-04-13)

- Original compact packet stated `UI only` as the full constitution check. Rewritten lane-scoped because `TTB-003` has an engineering sibling (`TTB-301`); `TTB-104`'s approved UI is the second of two prerequisites that unblock that engineering (`TTB-205` is the other), so both lanes are named here even though Codex cannot start yet.
- Acceptance criteria expanded to (a) explicitly freeze drill-in as a reuse of `TTB-102`, (b) require the `TTB-103` terminal `Open Dashboard →` action to route here, (c) require privacy anchoring on every dashboard surface including export.
- Scope is sharpened to dashboard + drill-in shell + export UI. The parallel engineering (matcher, orchestration, server export) sits under `TTB-301`; accessibility polish sits under `TTB-105`.
