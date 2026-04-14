# UI Component Spec — TTB-103

## Story

- Story ID: `TTB-103`
- Title: batch intake, matching review, and progress UI
- Parent: `TTB-003`
- Lane: Claude (UI) — engineering continues under `TTB-301`

## Problem

High-volume reviewers need a batch entry that accepts many label images plus one CSV of application data, shows how images and rows matched, lets them fix ambiguity fast, and walks through processing with believable progress. If the match step is confusing or the progress step looks fake, reviewers will not trust the dashboard that follows. The single-label flow (`TTB-101` / `TTB-102`) already established the workstation feel; batch must reuse it, not reinvent it.

## Users and use cases

- **Primary: high-volume TTB reviewer.** Processes dozens of labels in a session for a single importer or brand-owner submission. Wants to confirm the batch is set up correctly once and then trust the machine through processing.
- **Secondary: supervisor.** Spot-checks a large batch to see it is proceeding; cares about scale cues (counts, completed-over-total) and per-item confidence.
- **Secondary: demo viewer.** Needs to believe the flow works beyond the one-label scenario; will test malformed CSV and mismatched files.

Use cases covered in this story:

1. Upload many images + one CSV → confirm counts and match summary → start processing.
2. Resolve an ambiguous match (one image matches two rows, or one row matches two images) without leaving the page.
3. Resolve unmatched items by pairing an image to a row manually, or by dropping an item from the batch.
4. Watch progress advance believably; see incremental per-item status appearing in order of completion.
5. Recover from a malformed CSV, an unsupported file type, an oversized file, or a partial per-item failure during processing.
6. Land on a clear path into the batch dashboard when processing completes (TTB-104 surface, stubbed in this story).

## UX flows

### Flow 1 — Batch intake (happy path)

1. Reviewer clicks the `Batch` tab in the header (the toggle is already present from `TTB-101`, activated by this story).
2. Batch upload surface appears with two drop zones (label images, CSV) and an empty matching-review panel.
3. Reviewer drops many images; counts update. Reviewer drops one CSV; counts update, matching-review panel populates.
4. Panel shows matched pairs plus any unmatched or ambiguous items. Matching explanation sits above the list: "We match filenames to the `filename` column first, then fall back to row order when a filename is missing."
5. Reviewer inspects matches, fixes anything flagged, clicks **Start Batch Review**.
6. Surface switches to the batch processing view with a bounded progress indicator and a stream of completed items appearing as status badges.
7. On completion, a terminal banner offers **Open Dashboard** (the TTB-104 surface).

### Flow 2 — Resolve an ambiguous match

1. In the matching-review panel, an image is flagged `Ambiguous match — 2 candidate rows`.
2. Reviewer opens that item. A focused comparison appears in place (not a modal over the whole page): image thumbnail on one side, two candidate rows on the other.
3. Reviewer picks the correct row or marks the image as "Not in this batch" to drop it.
4. Panel counts update. The `Start Batch Review` primary action becomes enabled once every item is either matched or explicitly dropped.

### Flow 3 — Malformed CSV

1. Reviewer drops a CSV with unreadable headers or a parse error.
2. The CSV drop zone surfaces a readable, specific error under the zone. The image zone and images already uploaded stay intact.
3. Reviewer replaces the CSV. The error clears; matching review re-runs.

### Flow 4 — Partial failure during processing

1. Some items complete with `Pass` / `Review` / `Fail` badges; one item errors out.
2. The errored row shows `Error — retry available` in the completed-items stream, with an inline `Retry this item` action.
3. Processing continues for remaining items; overall progress continues; the reviewer can retry at any point without stopping the run.

### Flow 5 — Session loss guard

1. Reviewer navigates away from the batch mid-processing.
2. The UI warns that session-scoped work will not be recovered. On return, the reviewer lands on an empty batch intake. (No durable storage.)

## IA and layout

This story occupies two views inside the existing page shell. The top identification region (title, subtitle, `Single | Batch` toggle, privacy subtext anchor) is unchanged.

### View A — Batch intake (`view === 'batch-intake'`)

Desktop layout (≥`md`):

```
[existing top identification region — title, Single|Batch toggle, dev controls]
────────────────────────────────────────────────────────────────────────────
| Batch Upload                                                              |
| One-line intent copy under the heading.                                   |
|                                                                           |
|  ┌─────────────────────────────┐  ┌─────────────────────────────────────┐ |
|  │  Label images drop zone      │  │  Application data (CSV) drop zone  │ |
|  │  (multi-file)                │  │  (one file)                         │ |
|  │  supported types, size cap   │  │  required header hint                │ |
|  └─────────────────────────────┘  └─────────────────────────────────────┘ |
|                                                                           |
|  Count strip: "12 images · 1 CSV · 10 matched · 1 ambiguous · 1 unmatched"|
|  Matching explanation line.                                               |
|                                                                           |
|  Matching review panel                                                    |
|  ├ group: Ambiguous (1) — expanded by default                              |
|  │   [image thumb] filename.jpg → choose row: [row a] [row b] [drop]      |
|  ├ group: Unmatched images (1)                                            |
|  │   [image thumb] filename.jpg → pair with: [row picker] [drop]          |
|  ├ group: Unmatched rows (0)                                              |
|  └ group: Matched (10) — collapsed summary list                            |
|                                                                           |
|  Privacy reminder: Nothing is stored. Inputs are discarded when you leave.|
|                                                                           |
|  [Cancel back to Single]                         [Start Batch Review]     |
────────────────────────────────────────────────────────────────────────────
```

Stacks to single column below `md`. The two drop zones stack vertically; the matching review panel keeps full width and stays readable without compressing into icons.

### View B — Batch processing (`view === 'batch-processing'`)

```
[existing top identification region]
────────────────────────────────────────────────────────────────────────────
| Batch Processing                                                          |
| One-line intent copy ("Reviewing 12 labels. Nothing is stored.").         |
|                                                                           |
|  Progress readout                                                         |
|  "Processed 7 of 12 · 5 remaining · about 12 seconds left"                |
|  [progress bar]                                                           |
|                                                                           |
|  Completed-items stream (newest at top)                                   |
|  [badge]  label-07.jpg        — Fanciful Gin        — Review              |
|  [badge]  label-06.jpg        — Vintners' Red       — Pass                |
|  [badge]  label-05.jpg        — Bold Lager          — Fail                |
|  [badge]  label-04.jpg        — Heritage Whiskey    — Pass                |
|  [error]  label-03.jpg        — —                   — Retry available     |
|  ...                                                                      |
|                                                                           |
|  [Cancel batch]                                                           |
────────────────────────────────────────────────────────────────────────────
```

On completion:

```
|  All 12 labels reviewed.                                                  |
|  Summary: 7 Pass · 3 Review · 2 Fail                                      |
|                                                                           |
|  [Back to Intake]                          [Open Dashboard →]             |
```

`Open Dashboard →` is a placeholder until `TTB-104` lands; in this story it triggers a stubbed banner, it does not route away.

## States

### Batch intake

- **Empty** — both zones untouched. Primary action disabled with tooltip `Drop label images and an application CSV to continue.`
- **Images only** — image zone populated, CSV zone empty. Count strip shows image count; matching panel shows "Drop a CSV to match these labels to application data."
- **CSV only** — CSV zone populated, image zone empty. Count strip shows CSV row count; matching panel shows "Drop label images to match this CSV."
- **Matching complete, no blockers** — every image matched to a row, no ambiguity. Primary action enabled.
- **Matching has ambiguity or unmatched items** — primary action disabled. Count strip calls the number out. Matching panel surfaces the groups.
- **CSV error** — malformed CSV banner under the CSV zone; images retained; matching panel hidden and replaced with `We can't match yet — the CSV needs a fix.`
- **File error** (oversized or unsupported image) — error row listed above matching with the filename and the specific reason; reviewer can remove it or retry.
- **Batch cap reached** — soft cap of 50 images; when exceeded, additional drops are rejected with a specific message rather than silently discarded.

### Batch processing

- **Running** — progress readout active; completed stream animates as items finish; cancel action available.
- **Running with partial failure** — same as running plus at least one row with `Error — retry available`; inline retry does not block remaining items.
- **Cancelled** — progress halts; completed-items stream is preserved with a `Batch cancelled. Completed items shown below.` banner; path back to intake.
- **Completed, mixed** — terminal summary with `Open Dashboard →` primary action.
- **Completed, all-pass** — terminal summary with a quieter tone; same action.
- **Completed, all-fail** — terminal summary that does not feel celebratory; same action.

## Copy and microcopy

Canonical strings. Do not paraphrase without a new pass.

- Page headings: `Batch Upload`, `Batch Processing`.
- Intent lines: `Upload many label images and one CSV of application data. Nothing is stored.`, `Reviewing {N} labels. Nothing is stored.`.
- Matching explanation: `We match each image to a CSV row by the filename column first, then fall back to row order.`
- Count strip template: `{images} images · {csvRows} CSV rows · {matched} matched · {ambiguous} ambiguous · {unmatched} unmatched`.
- Group headings: `Ambiguous`, `Unmatched images`, `Unmatched rows`, `Matched`.
- Ambiguous item guidance: `Two rows look like a match. Pick the right one.`
- Unmatched image guidance: `No row matched this image. Pair it with a row, or drop it from the batch.`
- Unmatched row guidance: `No image matched this row. Pair it with an image, or drop it from the batch.`
- Resolution buttons: `Pair with a row`, `Pair with an image`, `Drop from batch`.
- Primary action: `Start Batch Review`. Tooltip when disabled because of ambiguity: `Resolve the {ambiguous} ambiguous and {unmatched} unmatched items first.`
- Secondary back-out: `Cancel and return to Single`.
- Progress readout templates: `Processed {done} of {total}`, `{remaining} remaining`, `about {secondsHuman} left`.
- Completed stream row template: `{filename} — {application-identity} — {Pass|Review|Fail|Error}`.
- Error row reason: `Error — retry available`. Retry action label: `Retry this item`.
- Cancellation banner: `Batch cancelled. Completed items shown below.`
- Terminal summary template: `All {total} labels reviewed. {pass} Pass · {review} Review · {fail} Fail.`
- Terminal actions: `Back to Intake`, `Open Dashboard →`.
- CSV error: `This CSV could not be read. Check the headers and try again.`
- Unsupported file: `{filename} isn't a supported image type.` Oversized: `{filename} is larger than 10 MB.`
- Batch cap: `This proof of concept accepts up to 50 labels per batch. Remove some to continue.`
- Privacy anchor: `Nothing is stored. Inputs and results are discarded when you leave.` (unchanged from single-label shell).

## Accessibility, privacy, performance

- **Keyboard.** Tab order: image drop zone → CSV drop zone → matching review items (group-by-group, item-by-item) → primary action. Enter activates resolution menus; Escape closes any inline resolution affordance and returns focus to the triggering row. `B` toggles back to Single mode from anywhere outside a form field, mirroring the single-label `N` (subject to keyboard-shortcut gating decision from TTB-102 handoff §Open questions #5).
- **Screen readers.** Matching review groups are a landmarked list with a heading and count; each row announces `{filename}, {match-status}, {action available}`. Progress readout uses an `aria-live="polite"` region.
- **Color independence.** Status vocabulary in the completed stream reinforces `Pass` / `Review` / `Fail` / `Error` with both icon and label, not color alone. Ambiguous and unmatched groups are distinguishable without color.
- **Reduced motion.** Progress bar is a smooth fill; under `prefers-reduced-motion` it snaps to percentages. Completed-items stream appends without animation when reduced motion is set.
- **Privacy.** No image, row, match identity, progress detail, or per-item outcome is logged to `console`, `localStorage`, `sessionStorage`, or any analytics hook. Image object URLs created for thumbnails are revoked on removal from the batch and on leaving the view. CSV contents are parsed client-side for now (seeded) and are never persisted. The `Nothing is stored…` line stays anchored.
- **Performance.** Batch intake must stay responsive up to the 50-label cap on a mid-tier laptop. Matching review renders as a list; at 50 rows it does not require virtualization. Progress stream renders at most the last 50 rows. First paint of batch intake after clicking the `Batch` toggle is under 100 ms (no data fetch involved in this story).

## Data and evidence needs from backend

Captured here for Codex (`TTB-301`, `TTB-201`) to consume. Claude does not edit shared contracts.

### Batch request (client → server)

- multipart form: `labels[]` (image files), `csv` (one text/csv file), optional batch-session client id.
- No durable batch id; session scope only.

### Matching result (server → client, before processing starts)

- `matched: Array<{ imageFilename, csvRowId, csvRowIdentity }>` — pair plus a short human identity string from the row, used in the completed stream.
- `ambiguous: Array<{ imageFilename, candidates: Array<{ csvRowId, csvRowIdentity }> }>` — client resolves to one candidate per image.
- `unmatchedImages: Array<{ imageFilename }>`
- `unmatchedRows: Array<{ csvRowId, csvRowIdentity }>`
- `csvError?: { message }` — returned when the CSV itself fails to parse; no matching payload when present.
- `fileErrors?: Array<{ imageFilename, reason: 'unsupported-type' | 'oversized' | 'duplicate' | 'other', message }>`

### Batch processing progress (server → client, streamed)

- `progress: { done: number, total: number, secondsRemainingEstimate?: number }` — emitted as items complete.
- `items: Array<{ imageFilename, csvRowIdentity, status: 'pass' | 'review' | 'fail' | 'error', recommendation?: 'approve' | 'review' | 'reject', errorMessage?: string, reportId?: string }>` — incremental; UI keeps the last 50 for the stream view.
- Stream shape: Codex may implement as SSE, chunked JSON, or polling; the UI only needs to receive these shapes monotonically.

### Batch completion (server → client)

- `summary: { total, pass, review, fail, error }`
- `dashboardHandle: { sessionId }` — the opaque reference the TTB-104 dashboard will use.

### Privacy constraints the server must preserve

- `store: false` on every OpenAI call, unchanged from single-label.
- No image, CSV row, or result is persisted beyond the live session.
- No per-item fields (reasons, confidences, citations) are logged in a way that persists.

## Frozen design constraints for Codex

1. **Shell continuity.** Top identification region, `Single | Batch` toggle, and `Nothing is stored…` privacy anchor remain identical to single-label. No sidebar, no breadcrumb, no new app chrome.
2. **Two views only in this story.** `batch-intake` and `batch-processing`. The dashboard is TTB-104's surface; `Open Dashboard →` is the only bridge into it.
3. **Matching review is inline.** Not a modal. Not a separate route. Groups render in a fixed order: `Ambiguous`, `Unmatched images`, `Unmatched rows`, `Matched` (collapsed by default).
4. **Status vocabulary.** `Pass` / `Review` / `Fail` / `Error`. No alternative words. `Error` is only for items that failed to complete at all; compliance outcomes remain `Pass` / `Review` / `Fail`.
5. **Count strip.** Exact order: images · CSV rows · matched · ambiguous · unmatched. Never rearrange.
6. **Primary action copy.** `Start Batch Review`. Enabled only when matching has zero blockers.
7. **Progress readout.** Text readout is primary; the progress bar reinforces, not the other way around. No percentage without its accompanying `{done} of {total}` count.
8. **Partial failure framing.** Per-item errors never abort the run. They appear in the stream with an inline retry and do not reduce the `{done}` count toward `{total}`.
9. **Privacy language.** Every view anchors the "nothing is stored" line. No copy implies cross-session workflow storage, review notes, assignments, or review history.
10. **Theme tokens only.** No raw hex. Extend `tailwind.config.js` and `INDUSTRIAL_PRECISION_THEME.md` together if a new token is needed — preferred approach is to reuse existing `tertiary` / `caution` / `error` / `secondary` families.
11. **Cap.** 50 labels per batch. If the reviewer drops more, reject the overflow with an inline message — do not silently discard.
12. **No dashboard preview.** The completed-items stream is chronological, not a triage table. Do not seed filters, sort, or summary cards here — those are TTB-104.

## Open questions (captured for Codex handoff)

1. **Matching response path.** Should matching results return on a separate `POST /api/batch/preflight` endpoint, or in the first streamed frame of the batch run? Default: a preflight endpoint — it lets the reviewer fix ambiguity before committing to a run.
2. **Stream shape.** SSE vs. chunked JSON vs. polling. Default: SSE. UI only needs monotonic updates.
3. **Secondsremaining estimate.** Is the server expected to emit a per-item ETA? If not, the UI will fall back to a simple smoothed average on the client. No design blocker either way.
4. **Retry semantics.** On retry of a single errored item, does the server return a new `reportId` or reuse the prior one? UI assumes new `reportId` per attempt.
5. **Duplicate filenames inside a batch.** Does the server de-duplicate, flag as ambiguous, or reject? UI prefers `fileErrors[].reason === 'duplicate'` so the reviewer resolves it explicitly.
6. **CSV header contract.** What columns are required (likely `filename`, `brand_name`, `class_type`, `alcohol_content`, plus beverage-conditional fields)? UI will accept whatever the parser reports but should render a readable identity string per row — needs to know which column drives that identity. Default preference: `brand_name` + `class_type`, falling back to `filename`.
7. **Resumability on page reload.** Out of scope for this proof of concept. Reload drops the session. If that changes, UI will need a session-restore path.

## Out of scope for this spec

- Dashboard layout, triage filters, sort controls, drill-in — `TTB-104`.
- Export UI — `TTB-104`.
- Server-side batch engine — `TTB-301`.
- Workflow state, assignments, or review notes — out of scope for the proof of concept.
