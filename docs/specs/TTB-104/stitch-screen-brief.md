# Stitch Screen Brief — TTB-104

## Story

- Story ID: `TTB-104`
- Title: batch dashboard, drill-in shell, and export UI
- Parent: `TTB-003`
- Lane: Claude (UI)

## 1. Screen goal

Design two screens for a TTB label verification workstation, inside the same single-page web application that already holds the single-label flow and the batch intake + processing flow: a **Batch Results** dashboard (three summary cards at the top, a filterable and sortable triage table underneath, a visible path to export the session) and a **Batch drill-in shell** (a slim navigation bar that wraps the existing single-label Results view without changing it, plus an affordance for when a row's detail isn't available).

The single-label Results view is already designed and must not be redesigned here; the drill-in shell is a thin wrapper around it. The batch intake + processing surfaces from the previous story are already designed and must remain consistent with this one. The dashboard is the new surface this story introduces.

## 2. Target user and moment

The primary user is a TTB reviewer who has just finished processing a batch of many labels and now needs to triage the outcomes. They want to see immediately, at a glance, how many of the labels in this batch need their eyes (rejects and reviews) and how many are safely approved. They want to work the rejects first, using a table that is dense enough to scan but readable enough to trust. Opening one row must land them inside the exact same evidence surface they already use for single-label review — anything else is a new interface they have to learn, which this tool refuses to create. They need a single export action for the whole session, so they can file the outcomes in their own records before the session disappears. Nothing about the dashboard may imply durable workflow state, assignment tracking, or review history — the tool is an instrument, not a case-management system.

A secondary user is a supervisor or procurement reviewer who wants to skim a subordinate's batch outcomes. The surface must read as a compliance workstation panel, not an analytics dashboard.

## 3. Screen prompt for Stitch

> **Platform: web only. Generate web output only (web screens and web HTML/code), not mobile, iOS, Android, or tablet-app artifacts.** This is a desktop-first web application for a government compliance workstation; touch is not the primary input. The browser is typically 1280–1440px wide under fluorescent office lighting.
>
> Design two screens as part of an existing single-page web application.
>
> **Screen 1 — Batch Results dashboard.** A reviewer arrives here after finishing a batch run. The screen must open with three equal-width summary cards showing the approve / review / reject counts for the session, in that order, each carrying a short descriptive line. Below the cards, a filter strip lets the reviewer switch between seeing every row, just the rejects, just the reviews, or just the approves. A separate sort control lets them change the triage order — default is worst-first (rejects rising to the top, then reviews, then approves, with highest-blocker-count rows rising inside each group). The triage table that fills the rest of the screen must carry enough identity per row for a reviewer to decide whether to open it without clicking: a status badge, a small image thumbnail (with a clear fallback for PDFs), the filename, the brand name and class/type from the CSV row, and a short indicator of how many issues the row has. Every row has an obvious `View details` action that opens the approved single-label Results view for that label. An action bar at the bottom carries a secondary `Export Results` action and a primary `Start Another Batch` action, with the persistent privacy assurance visible.
>
> **Screen 2 — Batch drill-in shell.** When the reviewer clicks `View details` on a row, they land on a drill-in screen. The existing single-label Results view (verdict banner, pinned image column, field checklist, warning evidence panel, cross-field checks, action bar) must be preserved verbatim. This screen's only job is to wrap that view with a clear `← Back to Batch Results` breadcrumb, a short positional indicator (e.g., "3 of 7 rejects"), and affordances to move to the previous or next row in the current filter without going back to the dashboard first. When a row's detail isn't available — the row errored during processing or the session's report is gone — a quiet advisory panel replaces the Results view and the only action is to return to the dashboard.
>
> Both screens live inside the same page shell as the single-label and batch intake flows. The top identification region (product title, tagline, and `Single | Batch` toggle) is already in place. Do not redesign that region, but please render it so the composition reads correctly. Every screen must visibly carry the privacy assurance that nothing is stored.

## 4. Required functional regions

**Screen 1 — Batch Results dashboard**

- An intent line immediately under the page heading that communicates scope (how many labels this dashboard covers) and the "nothing is stored" commitment.
- A three-card summary block, cards in the order approve, review, reject. Each card must carry a large count, a short label, and a short descriptive line. The cards are the first thing the reviewer's eyes land on.
- A filter strip that lets the reviewer switch between `All`, `Rejects only`, `Reviews only`, and `Approves only`. The currently active pill must be unmistakably active; every pill carries its own count.
- A sort control — a labeled selector — with four options: `Worst first` (default), `Filename`, `Brand name`, `Completed order`.
- A triage table with the columns Status, Label, Identity, Issues, Actions. Rows must read as a dense table, not as cards, and should accommodate up to 50 rows without horizontal compression.
- A small session-only "Reviewed" indicator appears on rows the reviewer has already drilled into during this session. It disappears on any filter change or leaving the surface.
- An action bar at the bottom carrying `Start Another Batch` and `Export Results`, plus a visible privacy line.
- An inline export confirmation region that appears in place of the export button when the reviewer clicks it (not a modal). The confirmation restates "one download, JSON, nothing is stored" and offers explicit confirm and cancel actions. During the download preparation moment, the same region communicates that work is in progress.

**Screen 2 — Batch drill-in shell**

- A breadcrumb bar above the existing Results view: `← Back to Batch Results` on the left, a compact "N of M in this filter" position indicator, and `Previous label` / `Next label` affordances on the right.
- The single-label Results view, reproduced but not redesigned: verdict banner, pinned image column, field checklist, warning evidence panel, cross-field checks, action bar.
- A dedicated "detail unavailable" panel that replaces the Results region when the row has no available report. It reads calmly and explains why the detail is missing. The only affordance is back to the dashboard.

## 5. Required states and variations to render

Render these distinct states so the returned HTML covers them. If one HTML artifact can represent more than one state via minor variation, make those variations explicit.

**Dashboard states:**

1. **Terminal — mixed outcomes** — full dashboard with a realistic spread of approve, review, reject rows. Default filter (`All`), default sort (`Worst first`). Errored rows present at the bottom of the `All` view.
2. **Terminal — all pass** — summary cards show all three counts, but Review and Reject are zero; every row in the table is Pass. The emotional register is quieter, not celebratory.
3. **Terminal — all fail** — summary cards show zero approves and reviews, all rejects; every row in the table is Fail. The emotional register is serious, not alarmist.
4. **Cancelled-partial** — a secondary intent line explains that the batch was cancelled and only part of it completed (e.g., "3 reviewed of 12 started · Batch cancelled"). Summary cards total to the completed count, not the started count. Triage table lists only the completed rows.
5. **Filtered — rejects only** — filter strip shows `Rejects only` active; the table lists every reject. The filter pills still show full-batch counts so the reviewer knows what they're filtering out of.
6. **Filter empty** — a filter selection that produces no rows. Empty-state message inside the table area with a `Clear filter` inline action.
7. **A row marked as "Reviewed" this session** — on one of the visible rows, a subtle indicator shows the reviewer already drilled into it; the rest of the row is unchanged.
8. **Export confirmation inline** — the `Export Results` button replaced with an inline confirmation row restating the terms of export, with `Confirm export` / `Cancel`.
9. **Export in progress** — the same inline region showing progress text; the button is disabled until the download triggers.
10. **Export error** — the inline region showing a calm retry-ready message with an inline `Retry` action.

**Drill-in states:**

11. **Drill-in — available (mid-table row)** — the full approved single-label Results view rendered inside the drill-in shell. Breadcrumb, position indicator (e.g., "3 of 7 rejects"), Previous and Next affordances all present and active.
12. **Drill-in — first row of the current view** — Previous label affordance is visually inert because there is no previous row in the current filter.
13. **Drill-in — last row of the current view** — Next label affordance is visually inert.
14. **Drill-in — unavailable** — the advisory panel replaces the Results region; only `Back to Batch Results` is available.

## 6. Copy anchors

These strings are content, not design. Render them verbatim.

- Page heading (Screen 1): `Batch Results`.
- Dashboard intent line templates: `Reviewing outcomes for {total} labels. Nothing is stored.` / `{done} reviewed of {total} started · Batch cancelled` / `Every label in this batch was approved.` / `Every label in this batch was rejected.`
- Summary card headings (exact, in order): `Approve`, `Review`, `Reject`.
- Summary card descriptions (exact): `Approve` → `Recommend approval`, `Review` → `Needs a human read`, `Reject` → `Clear violations`.
- Filter pill labels (exact, in order): `All`, `Rejects only`, `Reviews only`, `Approves only`. Pill template: `{Label} · {count}`.
- Sort control label: `Sort`. Sort options (exact, in order): `Worst first`, `Filename`, `Brand name`, `Completed order`.
- Triage table column headers (exact, in order): `Status`, `Label`, `Identity`, `Issues`, `Actions`.
- Row action labels: `View details →` (standard rows), `Retry this item` (error rows).
- Row status vocabulary (exact): `Pass`, `Review`, `Fail`, `Error`.
- Issues cell templates: `1 blocker · 2 major` / `3 minor` / `—` (no issues) / `review · low confidence` (low-confidence extraction).
- "Reviewed" session indicator: `Reviewed this session`.
- Empty filter: `No {filter} in this batch.` Clear-filter action: `Clear filter`.
- Action bar labels: `Start Another Batch` (primary), `Export Results` (secondary).
- Export confirmation: `One download. JSON format. Nothing is stored on our servers.` Actions: `Confirm export`, `Cancel`.
- Export in progress: `Preparing your export…`
- Export error: `Export didn't complete. Try again.` Action: `Retry`.
- Drill-in breadcrumb: `← Back to Batch Results`.
- Drill-in position indicator templates: `{index} of {total-in-view} rejects` / `{index} of {total-in-view} reviews` / `{index} of {total-in-view} approves` / `{index} of {total-in-view} labels`.
- Drill-in prev/next labels: `Previous label`, `Next label`.
- Drill-in unavailable: `This label's details aren't available. It may have errored during processing.` Only action: `Back to Batch Results`.
- Privacy anchor (exact, unchanged across the product): `Nothing is stored. Inputs and results are discarded when you leave.`
- Top identification region (unchanged from existing shell): product title `TTB Label Verification Assistant`, tagline `AI-assisted compliance checking`, `Single | Batch` toggle.

## 7. Feelings and intents

Aim for:

- **Instrument-like, calm, authoritative.** The dashboard is the next drawer of the same workstation instrument. Seeing it should feel like opening a panel on equipment you already use, not landing on a new product.
- **Triage-forward.** The summary cards and the worst-first sort together must make it obvious where to start. A reviewer should not have to choose where to look first — the composition should already be showing them.
- **Trust in drill-in continuity.** The drill-in must feel like stepping through a door, not entering a different room. The evidence language, colors, and layout of the single-label Results view are preserved without negotiation.
- **Dense but not crowded.** The table is a workbench — many rows fit comfortably, and each row is easy to scan. This is the Bloomberg-terminal register, not the marketing-landing-page register.
- **Honest about the session.** The privacy line is everywhere. Every export affordance restates what's happening. Nothing on the screen implies durable workflow state.

Explicitly avoid:

- **Analytics-dashboard energy.** No trend charts, no sparklines, no pie/donut breakdowns, no "batch quality score," no time-series. The summary cards are the entire visual summary.
- **Case-management / workflow energy.** No assignment columns, no reviewer attribution, no "last modified" timestamps, no status-beyond-triage language (e.g., no "in progress", "blocked on reviewer", "escalated"). Nothing implies this batch lives beyond the session.
- **Consumer / marketing / startup aesthetic.** No gradients on the summary cards, no hero illustrations, no progress-ring embellishments, no "Congratulations!" moment on all-pass, no red-exclamation panic on all-fail.
- **Mobile app energy.** No bottom tab bars, no swipe affordances on rows, no full-screen modals for the drill-in (drill-in is a shell that replaces the dashboard, not a modal over it).
- **Compressed status.** Do not reduce `Pass | Review | Fail | Error` to icon-only indicators on table rows. Reviewers must read them.
- **Over-design of the export affordance.** Export is a button that confirms once and triggers one download. It is not a wizard, not a preview pane, not a multi-step flow.

## 8. Returned Stitch references

Claude will run the automated Stitch flow (`STITCH_FLOW_MODE=automated` is already configured for this workspace) and record the generated references here.

- Stitch image reference: _pending_
- Stitch HTML/code reference: _pending_
- Date returned: _pending_
- Notes on which returned asset covers which state from §5: _pending_
- Deviations Claude normalized during implementation (recorded 2026-04-13 before implementation, following the TTB-102 / TTB-103 pattern):

  **Screen 1 (Batch Results Dashboard) — frozen-shell inventions dropped:**

  1. Header rewritten with `Compliance Hub | History | Standards` nav links — dropped; the app shell has never had "hub" nav. Header remains title + tagline + `Single | Batch` toggle only.
  2. User profile picture with an avatar URL in the header — dropped. The product has no user identity surface; this is an instrument, not a case-management tool.
  3. `Single | Batch` rendered as a segmented pill — normalized to the two-button tab pattern with `border-b-2 border-primary` on the active tab (the existing TTB-101/102/103 shell pattern).
  4. Footer nav (`Privacy Policy`, `Security Protocol`, `Audit Guidelines`) — dropped. The privacy line anchors in the action bar per brief §6.
  5. Decorative label thumbnails in the triage table applied a `grayscale → color on hover` effect — dropped. Playful hover effects are not instrument-like; thumbnails render in color at rest.
  6. Header `max-w-full` vs. main `max-w-[1400px]` mismatch — normalized so both use `max-w-[1400px]`.

  **Screen 1 — copy anchors normalized to brief §6:**

  7. Summary card headings `Approved` / `Review` / `Rejected` → `Approve` / `Review` / `Reject`.
  8. Summary card descriptions `All requirements met.` / `Manual verification required.` / `Regulatory violations detected.` → `Recommend approval` / `Needs a human read` / `Clear violations` (brief verbatim).
  9. Summary card counts rendered with a ` Labels` suffix — stripped to bare integers; the card heading already labels the count.
  10. Summary card status icons `check_circle` / `visibility` / `report` → normalized to the TTB-102 StatusBadge vocabulary (`check_circle` / `warning` / `cancel`).
  11. Filter pill labels `Rejects` / `Reviews` / `Approves` → `Rejects only` / `Reviews only` / `Approves only`, each rendered as `{Label} · {count}` per brief.
  12. Sort control label `Sort: Severity (Worst First)` → `Sort` + option `Worst first`, with the four options enumerated: `Worst first`, `Filename`, `Brand name`, `Completed order`.
  13. Triage-table columns collapsed from Stitch's six (`Status`, `Document`, `Brand Details`, `Classification`, `Issues`, `Actions`) back to the brief's five (`Status`, `Label`, `Identity`, `Issues`, `Actions`).
  14. Issues cell `2 Issues` / `1 Issue` / `None` → brief templates (`1 blocker · 2 major`, `3 minor`, `—`, `review · low confidence`).
  15. Row action `View details` → `View details →` (arrow affordance per brief).
  16. Missing intent line under the page heading — added `Reviewing outcomes for {total} labels. Nothing is stored.`

  **Screen 1 — states Stitch did not render (built):**

  17. Empty-filter state with `No {filter} in this batch.` plus `Clear filter` inline action.
  18. Export inline confirmation, export-in-progress, and export-error states (per brief §5.8–10).
  19. "Reviewed this session" indicator on rows the reviewer has drilled into.
  20. Cancelled-partial dashboard with the `{done} reviewed of {total} started · Batch cancelled` secondary intent line.
  21. `Error` row variant carrying the `Retry this item` action.

  **Screen 2 (Batch Drill-in Detail) — entire evidence region re-designed by Stitch; salvage only the shell:**

  22. Stitch produced a new verdict banner (`Compliance Failed` + invented secondary copy + `Internal Reference: TTB-772-CHK-91` audit ID) — all dropped. Drill-in reuses the TTB-102 `VerdictBanner` component verbatim (brief frozen-constraint #6).
  23. Field status vocabulary `Compliant` / `Failed` / `Review Required` → dropped. Drill-in uses TTB-102 `StatusBadge` with `Pass` / `Review` / `Fail` / `Info`.
  24. Invented field-row expansion layout (`- REQUIRED … / + DETECTED …` diff on a non-warning row) — dropped. TTB-102 reserves the character-aligned diff for the `government-warning` row only; ordinary rows use `FieldEvidence.tsx` (summary + explanation + severity + confidence + citations + optional comparison block) which is rendered verbatim from the approved component.
  25. Invented cross-field evidence text (`2023 Vintage is consistent with AVA harvest window for Chardonnay.`) — dropped. Cross-field checks render via the TTB-102 `CrossFieldChecks` component with values from the backing `VerificationReport`.
  26. `Internal Reference` audit ID per drill-in row — dropped (privacy-adjacent; same rule as TTB-103's dropped operator/audit IDs).
  27. Header / footer shell inventions (same as Screen 1) — same treatment.

  **Screen 2 — shell elements salvaged and rendered verbatim:**

  28. Breadcrumb: `← Back to Batch Results`.
  29. Position indicator: `{index} of {total} {filter-label}` (e.g., `3 of 7 rejects`).
  30. Previous / Next label affordances on the right side of the breadcrumb bar, inert at list boundaries per brief §5.12–13.

  **Overall:** Screen 1 is a normalize-in-place pass. Screen 2's only deliverable from Stitch is the shell; the approved `TTB-102` `Results` component renders beneath it unchanged.

### Automated run — 2026-04-13T22:21:50.720Z

- flow mode: `automated`
- user review required before implementation: `true`
- project: `TTB Label Verification System` (`3197911668966401642`)
- model: `GEMINI_3_1_PRO`
- device type: `DESKTOP`
- artifact folder: `docs/specs/TTB-104/stitch-refs/automated/2026-04-13T22-21-50-718Z`
- manifest: `docs/specs/TTB-104/stitch-refs/automated/2026-04-13T22-21-50-718Z/manifest.json`
- raw response: `docs/specs/TTB-104/stitch-refs/automated/2026-04-13T22-21-50-718Z/raw-response.json`

#### Generated screens

1. `Batch Results Dashboard`
   - screen id: `421d33167f0e4d68b0bb1da696501ede`
   - local HTML copy: `docs/specs/TTB-104/stitch-refs/automated/2026-04-13T22-21-50-718Z/01-batch-results-dashboard.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzkyOGRmOWRlYjlkNTQwYWQ5YTg1ZmFmZjhjOGU4YzdiEgsSBxCDmeS-iQEYAZIBIwoKcHJvamVjdF9pZBIVQhMzMTk3OTExNjY4OTY2NDAxNjQy&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0ugSSeCSYY9J52ffUDWT4iRAO355DU61udmPHp8tT1_7W80WvS7WKLo4uw9k4oYci0qNMLTK5ibpq7SmzRwnUoNQMOzrimPBh5cK6l-ZAgp0U1TJH2xOdE4WQ8p6mP2MV6suPXBQE8kez_8HRB6Draq0BzLPYlCZ0PENHMGi09fW2n9v1rVomf4ddLwBy8b1vOKHRPN0y9T3HA2v0dhE2CIEuvMWBdze62eSAxuzLIL6ncFYEImWxL7sQVQ
2. `Batch Drill-in Detail`
   - screen id: `38a0bf38c6d14008a0d5ac39d9269a46`
   - local HTML copy: `docs/specs/TTB-104/stitch-refs/automated/2026-04-13T22-21-50-718Z/02-batch-drill-in-detail.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzQ4OWY1YWU4MzI1OTRiMGI4MjgzNGY1ZjMzOWFlMDY1EgsSBxCDmeS-iQEYAZIBIwoKcHJvamVjdF9pZBIVQhMzMTk3OTExNjY4OTY2NDAxNjQy&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0uh7IVYCat5Dtv9GWrUSzlzarwQHh1HtkLnf6y85jBvpuUVUlPhBTm_po77M0Nkek_reoGsMrZe_7xWwuPZwc4IyfOVLBU9gBCt4qoi-5L5Mg_ZOX9hQKgu90R6DIRxUxxDKau0PaYJ6Dc2p5CppvPffntvRncHkvd7behVUuPJJK2NSzM46luNCtTxrOdn9CTLUUGUcuJ5ifG5E2R3icGMmQ0rgTyz979PabkVvJv8DLYFPNZNX2dyGgh4
