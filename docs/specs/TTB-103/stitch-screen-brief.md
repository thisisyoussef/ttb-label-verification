# Stitch Screen Brief — TTB-103

## Story

- Story ID: `TTB-103`
- Title: batch intake, matching review, and progress UI
- Parent: `TTB-003`
- Lane: Claude (UI)

## 1. Screen goal

Design two screens for a TTB label verification workstation, inside the same single-page web application that already holds the single-label flow: a **Batch Upload** screen (multi-image drop + single CSV drop + an inline matching-review section the reviewer can trust) and a **Batch Processing** screen (a believable, readable progress view with an incremental stream of completed items). Together they give a reviewer confidence that the batch is set up correctly before processing begins, and that processing is actually advancing once it does.

The dashboard that opens after processing is a different story (`TTB-104`) — do not design it here. When processing completes, show a plain terminal state with a clear affordance pointing the reviewer to the dashboard.

## 2. Target user and moment

The primary user is a TTB reviewer handling a large importer or brand-owner submission containing many labels and one application-data CSV. They are at their workstation, mid-afternoon, working fast. They need two things from this surface: (1) to trust the match between each image and its CSV row before they commit to a run, and (2) to believe the run is actually progressing once they press start. If either of those fails, they will not trust the dashboard.

A secondary user is a supervisor or procurement reviewer who may see this screen during a demo and is testing whether the matching step is legible and whether the progress step feels like a real pipeline rather than a loading animation.

## 3. Screen prompt for Stitch

> **Platform: web only. Generate web output only (web screens and web HTML/code), not mobile, iOS, Android, or tablet-app artifacts.** This is a desktop-first web application for a government compliance workstation; touch is not the primary input. The browser is typically 1280–1440px wide under fluorescent office lighting.
>
> Design two screens as part of an existing single-page web application.
>
> **Screen 1 — Batch Upload.** A reviewer arrives here after clicking a `Batch` toggle in the page header. They need to drop many label image files (JPEG, PNG, WEBP, or PDF — up to 50 files, up to 10 MB each) and drop one application-data CSV. Once both exist, the screen must show how the system matched each image to a CSV row — the reviewer has to see, at a glance, which items matched cleanly, which ones are ambiguous (one image that could belong to two rows), which images didn't find a row, and which rows didn't find an image. The reviewer must be able to resolve each ambiguous or unmatched item inline, on the same surface, without a modal dialog and without navigating away. Above the matched list, one short explanation makes the matching rule plain: filename first, row order as fallback. Below it, one primary action starts the batch — but only once matching has no blockers. Do not invent a separate "matching review" route; it lives here.
>
> **Screen 2 — Batch Processing.** After the reviewer starts the run, the page replaces the upload surface with a progress view. The reviewer must feel the pipeline is real and bounded — show how many labels are done, how many are left, and a text estimate of time remaining. Below that, show a stream of items as they finish, newest first, each carrying the established status vocabulary (`Pass`, `Review`, `Fail`, `Error`). Error items can be retried inline without interrupting the rest of the run. When every item finishes, the surface ends in a terminal summary with a clear path onward to the dashboard — which is a different screen and not part of this brief.
>
> Both screens live inside the same page shell as the existing single-label flow. The top identification region (product title, short tagline, and a `Single | Batch` toggle) is already in place. Do not redesign that region, but please render it so the composition reads correctly. Every screen must visibly carry the privacy assurance that nothing is stored — the single-label flow already anchors this line; preserve that commitment here.

## 4. Required functional regions

**Screen 1 — Batch Upload**

- A region that accepts many label image files (drag, drop, click to browse). The supported file types and the 10 MB per-file / 50 files-per-batch caps must be communicable without the reviewer hunting for them.
- A region that accepts exactly one application-data CSV file.
- A compact strip that tallies the uploaded images, the CSV rows, and the current match state (matched, ambiguous, unmatched) in a consistent order.
- A plain one-sentence explanation of how the matching works (filename first, row order as fallback).
- A matching review region that groups items into four legible sections in this order: ambiguous matches, unmatched images, unmatched rows, matched pairs. Matched pairs stay collapsed by default; the other three are visible by default if they contain anything. Ambiguous and unmatched items must each expose a resolution path — pick a row, pair with an image, or drop the item from the batch.
- A persistent privacy line somewhere on the screen stating nothing is stored.
- A primary "start the batch" affordance that is unmistakably the most important interactive element, and a secondary way back to single-label mode.

**Screen 2 — Batch Processing**

- A progress readout that is primarily text (done-of-total, remaining, time estimate) with a bounded visual reinforcement. The text, not the visual, must carry the meaning.
- A stream of per-item rows appearing in order of completion, newest at the top. Each row carries a filename, a short application identity (e.g., the brand name from the CSV row), and a status from the established vocabulary. Error rows expose an inline retry.
- A way to cancel the run.
- A terminal state that appears once every item finishes: a quiet summary of outcomes and a clear next step pointing the reviewer toward the dashboard.

## 5. Required states and variations to render

Render these distinct states so the returned HTML covers them. If one HTML artifact can represent more than one state via minor variation, make those variations explicit.

**Batch Upload states:**

1. **Empty** — both drop zones untouched. Primary action is clearly unavailable. The matching-review region communicates that it is waiting for both uploads.
2. **Images only** — image zone populated, CSV zone empty. Counts show image count. Matching-review region invites the reviewer to drop a CSV.
3. **CSV only** — CSV populated, image zone empty. Counts show CSV row count. Matching-review region invites the reviewer to drop images.
4. **Clean match, zero blockers** — every image matched to a row, no ambiguity, no unmatched items. The `Matched` group is collapsed, showing a short summary count and an affordance to expand. Primary action is the most obviously available action on the screen.
5. **Mixed match with ambiguity** — at least one ambiguous item (one image with two candidate rows), at least one unmatched image, at least one unmatched row, and several matched pairs. Primary action is unmistakably unavailable, and the reason is explicit. Ambiguous items expose two candidate rows and a way to pick one or drop the item. Unmatched items expose a way to pair manually or drop.
6. **CSV error** — the CSV itself failed to parse. The CSV zone communicates the failure in plain English; the image zone and any images already dropped remain untouched. The matching-review region communicates that matching is blocked until the CSV is fixed.
7. **File error** — one of the dropped images is oversized or unsupported. The offending file appears as a distinct error row above the matched list, with its filename and the reason, plus a way to remove it. Other uploads are untouched.
8. **Over-cap** — the reviewer tried to drop more than 50 images. A plain message explains the cap and invites removing some.

**Batch Processing states:**

9. **Running** — mid-run. Around half the items completed. Progress readout visible, stream populated, cancel available.
10. **Running with a partial failure** — same as running plus at least one row in the stream carrying an `Error — retry available` state with an inline retry. Other items continue to complete normally.
11. **Cancelled** — the reviewer cancelled mid-run. A banner says so. Already-completed items remain visible. There is a path back to intake but not a path onward to a dashboard.
12. **Terminal — mixed outcomes** — every item finished. Summary shows the split across `Pass`, `Review`, `Fail`, `Error`. A primary affordance points at the dashboard; a secondary affordance returns to intake.
13. **Terminal — all pass** — every item passed. Same layout, quieter emotional register. Same affordances.
14. **Terminal — all fail** — every item failed. Same layout, serious emotional register — not celebratory, not alarmist. Same affordances.

## 6. Copy anchors

These strings are content, not design. Render them verbatim.

- Page headings: `Batch Upload`, `Batch Processing`.
- Intent lines under the headings: `Upload many label images and one CSV of application data. Nothing is stored.`, `Reviewing {N} labels. Nothing is stored.`.
- Top identification region (unchanged from existing shell): product title `TTB Label Verification Assistant`, tagline `AI-assisted compliance checking`, `Single | Batch` toggle.
- Matching explanation line: `We match each image to a CSV row by the filename column first, then fall back to row order.`
- Count strip template: `{images} images · {csvRows} CSV rows · {matched} matched · {ambiguous} ambiguous · {unmatched} unmatched`.
- Group headings: `Ambiguous`, `Unmatched images`, `Unmatched rows`, `Matched`.
- Guidance strings: `Two rows look like a match. Pick the right one.`, `No row matched this image. Pair it with a row, or drop it from the batch.`, `No image matched this row. Pair it with an image, or drop it from the batch.`.
- Resolution affordances: `Pair with a row`, `Pair with an image`, `Drop from batch`.
- Primary action: `Start Batch Review`. Disabled tooltip: `Resolve the {ambiguous} ambiguous and {unmatched} unmatched items first.`
- Secondary action: `Cancel and return to Single`.
- Progress readout templates: `Processed {done} of {total}`, `{remaining} remaining`, `about {secondsHuman} left`.
- Status vocabulary: `Pass`, `Review`, `Fail`, `Error`.
- Stream row template: `{filename} — {application-identity} — {status}`.
- Error row reason: `Error — retry available`. Retry affordance: `Retry this item`.
- Cancel affordance (mid-run): `Cancel batch`.
- Cancelled banner: `Batch cancelled. Completed items shown below.`
- Terminal summary template: `All {total} labels reviewed. {pass} Pass · {review} Review · {fail} Fail.`
- Terminal affordances: `Back to Intake`, `Open Dashboard →`.
- CSV error message: `This CSV could not be read. Check the headers and try again.`
- Unsupported file: `{filename} isn't a supported image type.` Oversized file: `{filename} is larger than 10 MB.`
- Over-cap: `This proof of concept accepts up to 50 labels per batch. Remove some to continue.`
- Privacy anchor: `Nothing is stored. Inputs and results are discarded when you leave.`

## 7. Feelings and intents

Aim for:

- **Calm, authoritative, instrument-like.** This is a workstation tool used dozens of times a day by someone in their 50s under fluorescent office lighting. The batch surface should feel like the next drawer of the same instrument, not a different product.
- **Unmistakable trust on the match step.** The reviewer must immediately understand whether matching is clean or needs attention. Ambiguity and unmatched items must read as "look at this" without feeling alarmist or accusatory.
- **Honest progress.** Progress must feel like a real pipeline — bounded, legible, with text doing the primary work. It must not feel like a decorative loading screen or a marketing animation.
- **Quiet competence at the finish.** The terminal state should feel like the instrument returning a result, not a celebration screen. No confetti. No "You did it!" language.

Explicitly avoid:

- **Analytics-dashboard energy.** No hero charts, no radial progress rings, no sparkline marketing flourishes on the intake surface. The dashboard is a separate story and not part of this brief; anything that smells like a dashboard belongs there.
- **Consumer / marketing / startup aesthetic.** Nothing "friendly-bubbly", nothing "AI-magical", nothing that reads as a product launch page.
- **Mobile app energy.** No bottom tab bars, no full-screen modals for resolution steps, no swipe affordances. This is a desktop web application.
- **Decorative motion.** Progress is functional. No rings that spin for vibes. No skeuomorphic "scanning" animation across items.
- **Compressed status.** Do not reduce `Pass | Review | Fail | Error` to icon-only indicators in the completion stream. Reviewers must read them.

## 8. Returned Stitch references

Claude will paste the full brief inline in chat at the Stitch prep handoff and stop. After the user runs Stitch in Comet, the user returns at least one Stitch image reference and one Stitch HTML/code reference. Record them here when they arrive.

- Stitch image reference: _pending_
- Stitch HTML/code reference: _pending_
- Date returned: _pending_
- Notes on which returned asset covers which state from §5: _pending_
- Deviations Claude normalized during implementation (recorded 2026-04-13 before implementation, following the TTB-102 pattern):

  **Screen 1 (Batch Upload - Matching Workbench) — structural:**

  1. Drop zones missing entirely. Stitch jumped to a populated `42 Files / applications.csv` state and provided no place to actually drop files. Added two drop zones back (multi-file label zone + single CSV zone), supporting the Empty / Images-only / CSV-only states required by §5.
  2. Matching review flattened into one table. Restored the four ordered groups (`Ambiguous`, `Unmatched images`, `Unmatched rows`, `Matched`) with `Matched` collapsed by default per §4.
  3. Count strip missing. Restored the `{images} · {csv rows} · {matched} · {ambiguous} · {unmatched}` strip in the exact order required by §6.

  **Screen 1 — copy anchors normalized to brief §6:**

  4. Page heading `Batch Upload` was missing — added.
  5. Primary action `Start Batch Run` → `Start Batch Review`.
  6. Secondary action `Clear Batch` → `Cancel and return to Single`.
  7. Matching explanation rewritten from engineering-register back to brief verbatim: `We match each image to a CSV row by the filename column first, then fall back to row order.`
  8. Group label `VERIFIED MATCH` collapsed into `Matched` group header; ambiguous uses `Ambiguous`; unmatched uses `Unmatched images` / `Unmatched rows`.

  **Screen 1 — Stitch inventions dropped:**

  9. `Alignment Score 88%` mini-bar (§7 anti-pattern: analytics-dashboard energy) — dropped.
  10. `settings` + `account_circle` icons in the header (§7 anti-pattern: consumer-app energy) — dropped; page frame matches the TTB-101/102 header exactly.
  11. Footer nav (`Privacy Policy`, `Compliance Standards`, `Support`) — dropped; privacy anchor is the only footer concern.
  12. Max width `1920px` — normalized to `1400px` to match the TTB-101/102 shell.

  **Screen 2 (Batch Processing - Real-time Stream) — missing states:**

  13. Cancel affordance missing mid-run (§4 explicitly required one) — added `Cancel batch`.
  14. Terminal states (§5.12 mixed, §5.13 all-pass, §5.14 all-fail) all absent — implemented.
  15. Cancelled state (§5.11) absent — implemented with `Batch cancelled. Completed items shown below.` banner.

  **Screen 2 — copy anchors normalized to brief §6:**

  16. Page heading `Batch Run in Progress` → `Batch Processing`.
  17. Subheading `Processing 28 of 42 labels` → `Processed {done} of {total}` template.

  **Screen 2 — privacy-adjacent Stitch inventions dropped (no durable workflow storage is a hard product constraint):**

  18. Sidebar `Batch ID`, `Start Time`, `Operator: ID_7721_AUDIT` — dropped; no batch identity or operator ID lives in the UI.
  19. Per-row audit IDs (`ID: 0292-ERR`, etc.) — dropped.

  **Screen 2 — other Stitch inventions dropped:**

  20. Per-row label thumbnail images in the stream — dropped; stream is text-first per §4.
  21. Page-level `27-CFR Regulatory Compliance Standards` callout — dropped; citations belong in single-label evidence panels, not here.
  22. Mid-run `Current Tally` Pass/Review/Fail/Error summary cards (§7 anti-pattern: analytics-dashboard energy on a working surface) — dropped; counts appear only in the terminal summary per §4.
  23. Timestamp column in the stream — not in §6 template; dropped.
  24. Gradient progress bar with decorative 1-second easing — replaced with a flat bounded fill; readout text carries the meaning per §4.

  **Screen 2 — new elements required by brief that Stitch did not render:**

  25. `Open Dashboard →` terminal action — added on every terminal variant.
  26. `Back to Intake` terminal action — added.

### Automated run — 2026-04-13T21:24:00.388Z

- flow mode: `automated`
- user review required before implementation: `true`
- project: `TTB Label Verification System` (`3197911668966401642`)
- model: `GEMINI_3_1_PRO`
- device type: `DESKTOP`
- artifact folder: `docs/specs/TTB-103/stitch-refs/automated/2026-04-13T21-24-00-387Z`
- manifest: `docs/specs/TTB-103/stitch-refs/automated/2026-04-13T21-24-00-387Z/manifest.json`
- raw response: `docs/specs/TTB-103/stitch-refs/automated/2026-04-13T21-24-00-387Z/raw-response.json`

#### Generated screens

1. `Batch Upload - Matching Workbench`
   - screen id: `f4b44dc232cc46e3bf39fa2db026f98c`
   - local HTML copy: `docs/specs/TTB-103/stitch-refs/automated/2026-04-13T21-24-00-387Z/01-batch-upload-matching-workbench.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzI1ZGQzZjcwOTc5YzQ3OTViYmM0ZWZkYmIwZTU0MWQ2EgsSBxCDmeS-iQEYAZIBIwoKcHJvamVjdF9pZBIVQhMzMTk3OTExNjY4OTY2NDAxNjQy&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0ujmQ70scu8NCYNOd2MJt57OrFMbYB073mAZJGDz6IeKTYNgLs-J6VQfrXVqH3f6vvik5WBIhlQbY5q9yNefjuC0q79N57_sB1QcpW4JftOH3eAGm4l6csyTuSa_RUUySdsYFp7LfQUnxTBFQaQt5l4kqps_Kxh1ah3zAbu_vCnf7rlTuZGbRAjKioTHCf7UO1EcxoGmHXl5460YDkWvrpGoxzJuTcL93aFhYx6eRKX6uwvegDkKnQRmloo
2. `Batch Processing - Real-time Stream`
   - screen id: `2fe41c12b36f429492c55ffc1dff982a`
   - local HTML copy: `docs/specs/TTB-103/stitch-refs/automated/2026-04-13T21-24-00-387Z/02-batch-processing-real-time-stream.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzIyZWI4ZGE2ODI4YTQxMTk4ZGQ3ZmRhNmE4MmI4OWY2EgsSBxCDmeS-iQEYAZIBIwoKcHJvamVjdF9pZBIVQhMzMTk3OTExNjY4OTY2NDAxNjQy&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0uiYt4mbC_GrnSpc31hMKaRbjcPkxZmoyMuiOdH2dr2HXq65PZcXW2aKbOX_pE8eR63HACrWtejIFgF6hFADpFDqqe_RG9WT1m5g8KEuV29-8b9b0ajnyd6uscOtgh4oYhHD6-9TmWe5Tax7EB5aOHDjmPXEUeL2lGtY4Zbu3yar5Y-PZ-vtz3sWpPVQmMi54-yTBzrfISWFp1pjTGoWoNX9v6-IOJ94_5YYyfnnbpWHh4O_ih61diJuUDY
