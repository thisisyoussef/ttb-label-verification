# UI Component Spec — TTB-104

## Story

- Story ID: `TTB-104`
- Title: batch dashboard, drill-in shell, and export UI
- Parent: `TTB-003`
- Lane: Claude (UI) — engineering continues under `TTB-301`

## Problem

A reviewer who just finished a batch run needs three things immediately: (1) the headline counts — how much of this batch needs my eyes, (2) a sortable triage table that puts rejects and reviews at the top so I never scroll past work, (3) a way to open one row using the exact same evidence view I trust from single-label review, and return to the dashboard without losing my place. They also need to export the session for their own records before the batch is gone — nothing is stored.

If the dashboard introduces a new evidence model, a novel filter UI, or a drill-in that feels like "another product", the reviewer slows down and the batch mode fails its own promise. The design goal is "the next drawer of the same instrument" — the triage surface must feel native to the existing TTB workstation, not like an analytics dashboard bolted onto it.

## Users and use cases

- **Primary: high-volume TTB reviewer.** Just finished a 12–50 label batch. Wants to work the worst items first and confirm the approves. Triages across two or three sittings in a day.
- **Secondary: supervisor.** Wants to skim a subordinate's batch outcomes, confirm the rejects are legitimate, and export.
- **Secondary: demo viewer.** Needs to believe the dashboard is a real triage surface, that drill-in connects to the same evidence shown in single-label, and that export does something concrete.

Use cases covered in this story:

1. Read the session's summary counts at a glance and decide where to start.
2. Filter to `Rejects only` and work each row.
3. Sort by brand name alphabetically to batch-review one importer's submissions.
4. Open a row → land inside the approved `TTB-102` Results view for that label → return to the dashboard with the filter + sort preserved.
5. Export the full session as a single JSON file containing the summary plus every row's `VerificationReport`.
6. Recover from the "no rows match this filter" empty state by clearing the filter in one click.
7. Recover from an export error (retry inline).
8. Enter the dashboard from `TTB-103`'s batch-processing terminal summary via `Open Dashboard →`.
9. Leave the dashboard back to batch intake or back to single-label mode without losing unfinished work (there is no unfinished work — session state is ephemeral).

## UX flows

### Flow 1 — Entry and triage (happy path)

1. Batch run completes. `TTB-103` processing view shows terminal summary; reviewer clicks `Open Dashboard →`.
2. Dashboard view loads inside the same page shell. Top identification region unchanged. Summary cards render above the triage table.
3. Reviewer clicks `Rejects only` filter pill → table updates in place, counts in the filter pills still show the full-batch totals so the reviewer knows what they're filtering out of.
4. Reviewer clicks `View details` on the worst row → dashboard is replaced by the single-label Results view for that label, with a `Back to Batch Results` breadcrumb and a visible `1 of N rejects` position indicator.
5. Reviewer inspects evidence via the approved `TTB-102` surface. The surface is unchanged from single-label.
6. Reviewer clicks `Back to Batch Results` → dashboard restores with the same filter + sort + scroll position, and the row they just viewed is visibly marked as "Reviewed" with a small, session-only indicator.

### Flow 2 — Export the session

1. Reviewer clicks `Export Results` in the dashboard action bar.
2. A small confirmation surface (not a modal) confirms the export: `One download. JSON format. Nothing is stored on our servers.`
3. Reviewer confirms → browser download starts. Button state returns to idle.
4. Privacy anchor copy remains visible throughout.

### Flow 3 — Empty filter

1. Reviewer on a batch with no rejects clicks `Rejects only` → table shows `No rejects in this batch.` plus `Clear filter` action.
2. Reviewer clicks `Clear filter` → table restores.

### Flow 4 — Drill-in failure

1. Reviewer clicks `View details` on a row whose report is unavailable (e.g., the server dropped the session, or the item errored during processing).
2. Instead of the Results view, an advisory panel renders inside the drill-in shell: `This label's details aren't available. It may have errored during processing.` with `Back to Batch Results` as the only action.

### Flow 5 — Cancelled-batch dashboard

1. Reviewer cancelled a run mid-stream; only three of twelve items finished. Terminal view offered `Back to Intake`; if the reviewer instead clicks `Open Dashboard →` from the already-shown results they can still review the three completions.
2. Dashboard renders the three completed rows. Summary cards show `3 reviewed of 12 started · Batch cancelled` as a secondary line.
3. Drill-in, filter, sort, and export all work against the three available rows.

### Flow 6 — Return to batch intake / single-label mode

1. From the dashboard action bar, `Start Another Batch` returns to batch intake (clearing session state).
2. `Single` in the header toggle still switches to single-label mode, same as TTB-101/103.

## IA and layout

This story occupies two new view states inside the existing page shell. The top identification region (title, tagline, `Single | Batch` toggle, privacy subtext) is unchanged.

### View A — Batch Dashboard (`view === 'batch-dashboard'`)

Desktop layout (≥`md`):

```
[existing top identification region — title, Single|Batch toggle, dev controls]
────────────────────────────────────────────────────────────────────────────
| Batch Results                                                             |
| Reviewing outcomes for {N} labels. Nothing is stored.                     |
|                                                                           |
|  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐                 |
|  │  Approve       │ │  Review        │ │  Reject        │                 |
|  │  {count}       │ │  {count}       │ │  {count}       │                 |
|  │  {description} │ │  {description} │ │  {description} │                 |
|  └────────────────┘ └────────────────┘ └────────────────┘                 |
|                                                                           |
|  Filter strip: [All · N] [Rejects · N] [Reviews · N] [Approves · N]       |
|  Sort control: by {Worst first | Filename | Brand | Completed order}      |
|                                                                           |
|  Triage table                                                             |
|  ┌──────────────────────────────────────────────────────────────────────┐ |
|  │ STATUS  LABEL              IDENTITY              ISSUES  ACTIONS     │ |
|  ├──────────────────────────────────────────────────────────────────────┤ |
|  │ [Fail]  [img] filename.jpg Brand · Class          3      View →      │ |
|  │ [Fail]  [img] filename.jpg Brand · Class          2      View →      │ |
|  │ [Rev]   [img] filename.jpg Brand · Class          1      View →      │ |
|  │ [Err]   filename.jpg       (not available)        —      Retry       │ |
|  │ [Pass]  [img] filename.jpg Brand · Class          0      View →      │ |
|  │ ...                                                                  │ |
|  └──────────────────────────────────────────────────────────────────────┘ |
|                                                                           |
|  Privacy reminder: Nothing is stored. Inputs and results are discarded…   |
|                                                                           |
|  [Start Another Batch]            [Export Results]                        |
────────────────────────────────────────────────────────────────────────────
```

On narrower viewports the summary cards stack to 3×1 then 1×3; the triage table keeps a readable row density and may horizontally scroll if needed rather than compressing columns into icons.

### View B — Batch drill-in shell (`view === 'batch-result'`)

```
[existing top identification region]
────────────────────────────────────────────────────────────────────────────
| ← Back to Batch Results      ·      3 of 7 labels in this view           |
|                                                                          |
| [The full TTB-102 Results view renders here, unchanged.]                 |
|                                                                          |
| Action bar includes `Previous label` and `Next label` in addition        |
| to the standard `New Review` and `Export Results`.                       |
────────────────────────────────────────────────────────────────────────────
```

The TTB-102 Results surface is reused verbatim: verdict banner, pinned image column, field checklist, warning evidence, cross-field checks, standalone / no-text variants. The only additions are the breadcrumb bar above and the Previous/Next label affordances in the action bar. Nothing inside the Results component is edited.

### Export confirmation (inline, not a modal)

Activated when `Export Results` is clicked; replaces the button with an inline confirmation row until the download starts or the reviewer cancels. Not a modal. Not a separate route.

## States

### Dashboard

- **Terminal — mixed outcomes** — real spread of Pass / Review / Fail / Error. Default view; default sort = Worst first.
- **Terminal — all pass** — summary cards show `N` in Approve, `0` in Review, `0` in Reject. Triage table lists every row as Pass. Quieter emotional register.
- **Terminal — all fail** — summary cards show `0 / 0 / N`. Triage table lists every row as Fail. Serious emotional register.
- **Cancelled-partial** — secondary intent line `{done} reviewed of {total} started · Batch cancelled`. Only completed rows present. Summary cards total to `done`, not `total`.
- **Filter empty** — `No {filter} in this batch.` with `Clear filter` inline action. Summary cards and filter pills remain visible with their full-batch counts.
- **Export in progress** — `Export Results` button replaced with an inline confirmation row (`Preparing your export… One download. Nothing is stored.`), disabled interim.
- **Export error** — replaces the same confirmation row with `Export didn't complete. Try again.` + `Retry` inline.
- **Row action "Retry" on errored rows** — rowwise; triggers the same retry path `TTB-103` exposes during the run (for the post-run dashboard, retry may re-enter a single-label pipeline for just that image; see "Data and evidence needs" below).

### Drill-in shell

- **Available** — the full `TTB-102` Results view renders. `Back to Batch Results` + `Previous label` / `Next label` affordances visible.
- **Unavailable** — `This label's details aren't available. It may have errored during processing.` with only `Back to Batch Results`.

## Copy and microcopy

Canonical strings. Do not paraphrase.

- Page heading: `Batch Results`.
- Intent lines:
  - Default: `Reviewing outcomes for {total} labels. Nothing is stored.`
  - Cancelled-partial secondary: `{done} reviewed of {total} started · Batch cancelled`
  - All-pass secondary: `Every label in this batch was approved.`
  - All-fail secondary: `Every label in this batch was rejected.`
- Summary card headings (exact): `Approve`, `Review`, `Reject`.
- Summary card descriptions (exact):
  - `Approve`: `Recommend approval`
  - `Review`: `Needs a human read`
  - `Reject`: `Clear violations`
- Filter pill labels (exact order): `All`, `Rejects only`, `Reviews only`, `Approves only`. Each pill template: `{Label} · {count}`.
- Sort control label: `Sort`. Sort options (exact order):
  - `Worst first` (default)
  - `Filename`
  - `Brand name`
  - `Completed order`
- Triage table column headers (exact): `Status`, `Label`, `Identity`, `Issues`, `Actions`.
- Row action (primary): `View details →`. Row action (errored row): `Retry this item`.
- Row status vocabulary: `Pass`, `Review`, `Fail`, `Error` (unchanged from `TTB-103`).
- `Issues` column template: `{n} blocker · {m} major` collapsed into a short readable form (e.g., `1 blocker · 2 major`, `3 minor`, `—` when no issues). When extraction was low-confidence the cell shows `review · low confidence`.
- Empty filter: `No {filter} in this batch.` with `Clear filter` button.
- Drill-in breadcrumb: `← Back to Batch Results`.
- Drill-in position indicator: `{index} of {total-in-current-view} {filter-label}` (e.g., `3 of 7 rejects`, `1 of 12 labels`).
- Drill-in unavailable: `This label's details aren't available. It may have errored during processing.`
- Action bar primary: `Start Another Batch`. Secondary: `Export Results`.
- Export confirmation row: `One download. JSON format. Nothing is stored on our servers.` plus `Confirm export` / `Cancel`.
- Export in progress: `Preparing your export…`
- Export error: `Export didn't complete. Try again.` plus `Retry`.
- Privacy anchor (unchanged): `Nothing is stored. Inputs and results are discarded when you leave.`

## Accessibility, privacy, performance

- **Keyboard.** Tab order: filter pills → sort control → triage table rows → action bar. Within the table, Arrow up/down moves row focus; Enter opens the focused row's drill-in; Escape from drill-in returns to the dashboard. `E` anywhere outside a form field focuses the export confirmation (subject to the `TTB-102` shortcut-gating open question).
- **Screen readers.** Summary cards are a landmarked list announced as `{count} {recommendation}`. The filter strip is a tab list with `aria-selected` on the active pill. The triage table is a `role="table"` with `aria-sort` on the currently active sort column. Drill-in breadcrumb uses `aria-label="Back to batch results"`. Export confirmation uses `aria-live="polite"` during the `Preparing…` state.
- **Color independence.** Every row status carries icon + label; summary cards carry icon + text + color tint; filter pills carry label + count text, never relying on color alone.
- **Reduced motion.** Sort / filter transitions render without animation under `prefers-reduced-motion`. Drill-in enter/exit does not slide.
- **Privacy.** No row identity, filename, brand name, confidence, issue count, or report payload is logged to `console`, `localStorage`, `sessionStorage`, or analytics. Export creates an in-memory blob URL that is revoked immediately after the download triggers. Drill-in reuses the `TTB-102` privacy guarantees (no result-value logging, image preview URL revocation).
- **Performance.** Dashboard first paint under 150 ms after `Open Dashboard →` on a mid-tier laptop. Triage table renders up to the 50-label batch cap without virtualization. Filter / sort transitions are in-memory and under 50 ms. Drill-in enter is < 200 ms.

## Data and evidence needs from backend

Captured here for Codex (`TTB-301`) to consume. Claude does not edit shared contracts.

### Dashboard summary (server → client)

Server exposes a session-scoped summary the UI can fetch after `Open Dashboard →`:

- `batchSessionId: string`
- `phase: 'complete' | 'cancelled-partial'`
- `totals: { started: number, done: number }` — with cancelled-partial: `done < started`; with complete: `done === started`
- `summary: { pass: number, review: number, fail: number, error: number }`
- `rows: Array<BatchDashboardRow>` where each row contains:
  - `reportId: string | null` — `null` iff the row errored; used for drill-in
  - `imageId: string` — stable within the batch session
  - `filename: string`
  - `identity: { brandName: string, classType: string }` — verbatim from the CSV row, or empty strings for errored rows
  - `beverageType: 'distilled-spirits' | 'wine' | 'malt-beverage' | 'unknown'`
  - `status: 'pass' | 'review' | 'fail' | 'error'`
  - `previewUrl: string | null` — preview of the uploaded label (blob/object URL or server-rendered thumb), `null` for PDFs
  - `isPdf: boolean`
  - `issues: { blocker: number, major: number, minor: number, note: number }` — from the underlying report's checks + cross-field checks; `{0,0,0,0}` for errors
  - `confidenceState: 'ok' | 'low-confidence' | 'no-text-extracted'` — mirrors the report's `extractionQuality.state`
  - `errorMessage: string | null`
  - `completedOrder: number` — the 1-based order the row finished in during the run; used for the `Completed order` sort

### Drill-in (server → client)

- `GET /api/batch/:batchSessionId/report/:reportId` returns a full `VerificationReport` (the TTB-201 shape). The UI feeds it directly to the approved `Results` component; no reshaping on the client.
- When `reportId` is `null` or the fetch returns 404 / 410, the UI renders the drill-in unavailable state.

### Export (server → client)

- `GET /api/batch/:batchSessionId/export` returns a JSON file (Content-Disposition: attachment; filename=`ttb-batch-<sessionId>.json`) containing:
  - the dashboard payload above
  - a `reports: Record<reportId, VerificationReport>` map for every non-errored row
  - a `generatedAt: string` ISO timestamp
  - a `noPersistence: true` flag
- The UI may alternatively generate the export client-side from already-fetched data; server route is preferred so reviewers can trust the export was produced once in a consistent place. Either path must avoid writing anything to durable storage.

### Row retry (server → client)

- Errored rows expose a `Retry this item` action. The server exposes `POST /api/batch/:batchSessionId/retry/:imageId` (reusing the TTB-103 handoff's retry endpoint). On success the row transitions to one of `pass` / `review` / `fail` (or stays `error` with a new `errorMessage`), and the dashboard counts update.

### Privacy constraints the server must preserve

- `store: false` on every OpenAI call (unchanged from single-label).
- No dashboard payload, export payload, or row identity is persisted beyond the live session.
- `batchSessionId` is ephemeral; a page reload loses it. UI does not attempt restore.

## Frozen design constraints for Codex

1. **Shell continuity.** Top identification region, `Single | Batch` toggle, and `Nothing is stored…` privacy anchor are identical to TTB-101 / TTB-102 / TTB-103. No sidebar, no new app chrome.
2. **Three summary cards, fixed order.** `Approve`, `Review`, `Reject`. The `Error` count is not a fourth card — it appears only in the filter pills and row status because "Error" is not a compliance outcome.
3. **Filter pills, fixed order.** `All`, `Rejects only`, `Reviews only`, `Approves only`. `Error` rows appear under `All` only and are denoted by the row-status badge.
4. **Triage table columns, fixed order.** `Status`, `Label`, `Identity`, `Issues`, `Actions`.
5. **Default sort is Worst first.** Rejects above Reviews above Approves; within a status group, higher blocker/major counts rise to the top; Error rows sink to the bottom of the All view and are never shown under filtered views unless the filter is `All`.
6. **Drill-in reuses the TTB-102 Results view verbatim.** No edits inside `Results.tsx`, `VerdictBanner.tsx`, `FieldRow.tsx`, `FieldEvidence.tsx`, `WarningEvidence.tsx`, `WarningDiff.tsx`, `CrossFieldChecks.tsx`, `StandaloneBanner.tsx`, `StatusBadge.tsx`, `ConfidenceMeter.tsx`, `NoTextState.tsx`, `ResultsPinnedColumn.tsx`. The only new code here is the drill-in shell wrapper that supplies the breadcrumb + Previous/Next label controls + drill-in-unavailable state.
7. **Export is one download.** Not multiple files, not a streaming artifact, not a preview pane. If CSV export is requested later, that is a separate story.
8. **No "Reviewed" persistence.** The session-only reviewed indicator on dashboard rows after drill-in is a local-state-only visual; it never goes to the server and never survives a reload.
9. **Privacy anchor on every surface.** Dashboard, drill-in, export-confirmation, export-in-progress, export-error all carry `Nothing is stored…`.
10. **`Open Dashboard →` from TTB-103 routes here.** The placeholder alert in `BatchProcessing.tsx` is replaced with a view transition. No other code in `BatchProcessing.tsx` changes.
11. **Theme tokens only in UI.** Same rule as TTB-101 / TTB-102 / TTB-103. The `labelThumbnail.ts` SVG-content hex exception continues to apply.
12. **No dashboardy analytics energy.** No trend charts, no sparkline, no per-category pie, no time-series, no "batch quality score". The summary cards already say all that needs to be said. Analytics-dashboard energy is an explicit anti-pattern (§7 of the Stitch brief).

## Open questions (captured for Codex handoff)

1. **Export format scope.** JSON only for the POC. If Codex wants to ship CSV or PDF variants, that is a new story and a new UI pass; do not add them into this story's export action.
2. **Retry-on-dashboard semantics.** Does retrying an errored row after the run has completed create a new `reportId` (UI's preferred default) or reuse the original `imageId` as the report handle? UI assumes the former.
3. **Session TTL.** How long does the server keep a completed batch session available for drill-in and export? UI assumes at least the lifetime of the page; a shorter TTL would require a visible "session expiring" affordance, which this story does not design.
4. **Concurrent drill-in.** Can multiple drill-ins be open in tabs? UI assumes no (single-page shell); concurrent tabs would multiply the session state. Not a design concern unless Codex wants it.
5. **Dashboard entry from outside a terminal.** Right now the only entry point is `Open Dashboard →` after the TTB-103 processing view finishes. If Codex exposes a way to re-enter a recent session (e.g., via a URL parameter), that's a new UI pass for the entry affordance.
6. **Previous / Next label in drill-in.** Should the drill-in's `Previous label` / `Next label` respect the dashboard's current filter (so "next reject" means the next reject within the current filter)? UI default: yes — filter is the lens.
7. **"Reviewed" indicator scope.** The session-only indicator after drill-in is a UX nicety. If Codex thinks it implies durable workflow state, we can drop it. UI default: keep, because the indicator is visibly transient (it disappears on any filter change or leave).

## Out of scope for this spec

- Server-side batch parser, matcher, orchestration, session export engine — `TTB-301`.
- Accessibility polish and trust copy pass — `TTB-105`.
- Guided review / help layer — `TTB-106`.
- Changes to the `TTB-102` single-label evidence model — only `TTB-201` extends that contract.
