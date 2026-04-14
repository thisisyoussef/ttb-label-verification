---
story: TTB-102
title: single-label results, warning evidence, and standalone — Stitch brief
owner: Claude (UI lane)
status: Stitch references returned; implementation in progress
updated: 2026-04-13
---

# Stitch Screen Brief — TTB-102 single-label results, warning evidence, and standalone

This brief is for the user to run manually through Google Stitch in Comet. Claude implements from the returned references. Stitch owns all visual decisions (color, type, spacing, component styling, iconography, exact dimensions). This brief describes who the user is, what they're trying to do at this moment, what states must exist, what it should feel like, and what it must not feel like. Do not include the intake or processing screens — those belong to `TTB-101` and are already frozen; this story extends the same page frame.

## 1. Screen goal

Design the **results** surface for a single-label review in the same web application introduced in `TTB-101`. The reviewer has finished the processing step and now needs to (a) read a recommendation, (b) see a field-by-field checklist, (c) go deep on any row that matters — especially the government warning — and (d) either start a new review or, when they ran a standalone check, deepen the review with full comparison. The results surface must also handle two secondary but important modes in the same frame: **standalone mode** (the reviewer did not enter application data) and **no-text-extracted** (the system couldn't read enough from the image).

## 2. Target user and moment

- **Who:** the same federal compliance reviewer audience from `TTB-101`. A career reviewer, typically 45–65, reading alcohol labels against regulations all day at a desktop workstation. Some are decades-experienced judgment workers who will abandon the tool on sight if it feels like a demo. Some are junior checklist workers who need explicit evidence and citations. Leadership occasionally watches a session.
- **Where:** a brightly-lit government office, desktop monitors, mouse and keyboard, no touch.
- **Moment:** the second-through-sixtieth second after a review finishes. The reviewer's eyes land first on the verdict, then on the checklist, then on one or two specific rows they want to inspect. They will either commit to the verdict in under a minute (happy path) or spend longer in the warning detail when the warning text is defective.
- **Emotional target:** authoritative, calm, precise — a continuation of the instrument posture established in `TTB-101`. The reviewer should feel that the system is *showing its work* without lecturing, and that they retain judgment. The results surface must not feel celebratory when the verdict is positive, alarming when it's negative, or apologetic when it's ambiguous — it should feel evenly calibrated across all three verdicts. It must not feel like a consumer product, a marketing dashboard, a startup SaaS analytics view, or anything "AI-magical."

## 3. Screen prompt for Stitch

> **Platform: web only.** Continue the existing desktop-first **web application** "TTB Label Verification Assistant" from a prior brief. Generate **web output only** (web screens and web HTML/code). Do not generate mobile app screens, iOS or Android layouts, tablet-app chrome, or any non-web artifact. The deliverable is a web interface rendered in a browser on a desktop monitor, with graceful responsive behavior down to tablet and narrow-browser widths. Touch is not the primary input; mouse and keyboard are.
>
> The tool helps a U.S. federal alcohol-beverage compliance reviewer check whether an alcohol label complies with government regulations. The reviewer has already uploaded a label photo, entered optional application data, and watched the system work through a deterministic pipeline. Now they see the **results** surface. You are designing only the results screens and their supporting variants — the intake and processing screens exist already and must not be redesigned.
>
> The page frame from the prior screens is preserved: a compact top identification region with the application's name, its one-line purpose, and a single-label / batch mode choice; a pinned region on the left that carries the reviewer's input context (a thumbnail of the label, its filename and size, and the beverage type they chose), which persists from the processing screen into the results screen without moving, resizing, or losing visual identity. The reviewer must feel that the same page is now *showing them what it found*, not that they navigated somewhere new.
>
> **Audience and feeling.** The reviewer is a career government worker, often in their 50s or 60s, reading labels under bright fluorescent lighting. They do this job all day, every day. The results surface must feel like a precision instrument — calm, information-dense, authoritative, respectful of their expertise. Think of the register of a well-designed scientific instrument, a professional spreadsheet, or an oscilloscope readout. The verdict must land immediately without theater; the evidence must be readable without hunting; the depth-on-demand must reward the reviewer without overwhelming them.
>
> **The results screen.** The reviewer's eye must land first on an unmistakable **verdict** at the top of the working area — a single, clearly-named recommendation (approve, review, or reject) with an accompanying icon and a compact summary of how many individual checks passed, needed review, and failed. The verdict must be instantly recognizable at a glance and must not rely on color alone; the icon and the written label must carry the meaning independently. The three verdicts must feel evenly calibrated — positive results are not celebratory, negative results are not alarming, ambiguous results are not apologetic. The verdict is the single most prominent element on the screen and must be the first thing any reviewer (or leadership demo viewer) sees.
>
> Immediately below the verdict is a **checklist**, in reading order, of every individual check the system ran against the label. Each checklist row shows, in one line: the name of the field or check, the value the reviewer entered (the "application value"), the value the system read off the label (the "extracted value"), and the status of that check. The row must communicate status at a glance through an icon and a written label (pass, review, or fail), reinforced by color but never dependent on it. When the check is more serious, a compact indicator of severity (blocker, major, minor, or note) is visible to the right of the status — reviewers rely on that to prioritize which rows to inspect first.
>
> Each row is **expandable on demand** with a single click or a keyboard press. Expanding a row reveals its evidence in place, under the row header, without teleporting the reviewer anywhere. Only one row is expanded at a time; opening a new row closes any previously-opened row automatically, so the screen never becomes an overwhelming scroll of opened panels. The reviewer must be able to tell instantly which row is the "parent" of the open panel and which are still collapsed.
>
> The expanded evidence panel for an ordinary row shows, in reading order: a single-line plain-language summary of what the system found; a short paragraph of plain-language explanation; a compact indicator of how confident the system was in its reading of that field (with the confidence calibrated visually so the reviewer can tell the difference between trustworthy and uncertain at a glance, without having to read the number); and a small list of authoritative regulation citations. When the row is about a simple comparison between the application value and the extracted value, the panel also includes a comparison block that makes the difference unmistakable — for example, a casing difference should read differently from a full value mismatch.
>
> The **government warning row** is the single most important row on the screen. Its expanded evidence panel is structured differently from the other rows, because the government warning is a rejection-critical, exact-text-plus-formatting surface and the reviewer will spend measurably more time here than anywhere else. Its expanded panel must contain, in reading order: a set of named sub-checks (each with its own status) covering presence of the warning, exact wording, the uppercase-bold heading, continuous-paragraph formatting, and legibility; a character-aligned comparison between the canonical required warning text and the text the system read off the label, with differences made visually unmistakable (characters that differ, characters that are missing, and characters whose capitalization is wrong must each read as a distinct kind of difference — reinforced with iconography or labels so they remain distinguishable without color); a compact confidence indicator specific to the warning read; and a short list of regulation citations. The comparison block must remain readable at small sizes under bright office lighting and must not collapse to illegible widths on narrower viewports — if horizontal space is tight, the comparison may scroll horizontally, but must not soft-wrap in a way that breaks positional alignment. The reviewer should feel they could defend a reject-by-warning verdict to a colleague using only what this panel shows.
>
> Below the field checklist, a separate **cross-field checks** section lists checks that depend on multiple fields together (for example, "vintage requires appellation", "imported country present", or "ABV format permitted for this beverage type"). The rows in this section behave exactly like the field rows above — same expand-on-demand, same evidence shape — but live under a section heading so the reviewer understands that these checks are structurally different from single-field checks. If no cross-field checks apply to this label, the section still appears with a short, neutral one-line explanation — its presence itself is evidence to the reviewer that the system ran those checks and came up with nothing to flag.
>
> At the end of the results working area, an **action bar** holds the primary and secondary reviewer actions. The primary action is to start the next review; it must be unmistakably the most important interactive element in the action bar, and it must be reachable by keyboard. A secondary action exports the result set — include it in the design; whether it is live or deferred is decided separately. When the reviewer is in standalone mode, a third action offers to deepen the current review into a full comparison.
>
> **Standalone mode variant.** Sometimes the reviewer runs the review without entering application data — for example, during a quick triage pass or when the application isn't at hand. In that case the results screen must render a distinct, clearly-communicated standalone variant inside the same frame. A compact info band between the counts and the checklist announces in plain language that this is a standalone review and that extracted values, not comparisons, are shown. The checklist drops the "application value" column — there is no comparison to make — and shows only the extracted value next to the status. Cross-field checks that depend on application data are collapsed into a single neutral line explaining that they were skipped and will run when the reviewer uses the "run full comparison" action. That action lives in the info band and in the action bar, and when used, returns the reviewer to the intake screen with the extracted values pre-filled into the form so they can edit and re-verify. Standalone must feel coherent and intentional — a first-class mode, not a broken or half-finished variant of the comparison path.
>
> **No-text-extracted variant.** When the system could not read enough text from the image to produce meaningful results (the photo was blurry, cropped, or too low-contrast), the results screen must render a dedicated recoverable state inside the same frame. The verdict is replaced by a neutral advisory band — not alarming, not apologetic — that explains in plain language that the system couldn't read enough text from the image and reassures the reviewer that their inputs were not saved. Two actions follow: try another image, which clears the image and returns the reviewer to the intake screen with their fields intact; and continue with caution, which renders whatever partial evidence the system produced and flags every row as low-confidence so the reviewer reads it with care. The pinned image context (thumbnail, filename) remains visible throughout. The standard field checklist is hidden in this state unless the reviewer chooses to continue with caution.
>
> **Low-confidence variant.** When the system did produce a full result but its confidence in the extraction is below the trust threshold, the verdict banner shows the `review` recommendation and carries a short secondary line acknowledging that extraction confidence was low. Affected rows render their confidence indicator with a visibly weaker fill — the difference between a trustworthy row and an uncertain row must be obvious at a glance without reading the number. Unaffected rows remain trustworthy.
>
> **Across all variants.** Status and state never rely on color alone. Every verdict, every status, every severity, and every confidence level is reinforced by iconography or labels so a colorblind reviewer reads it the same way. Type is comfortable for older readers under fluorescent lighting. Every interactive element is reachable by keyboard: expanding rows, collapsing rows, moving between rows, and triggering the primary action all have keyboard paths and visible focus. Motion, if any, is functional (signaling that a row has expanded, signaling that the verdict has arrived) and never decorative. The results surface must feel like the same page frame as intake and processing with its working content swapped, not like a different view — the pinned image context, the top identification region, and the single-label / batch mode choice remain where they were, visually unchanged.

## 4. Required functional regions

### Results screen (comparison mode)

- Top identification region and single-label / batch mode choice, visually unchanged from the intake and processing screens.
- Pinned input-context region on the left (thumbnail, filename, file size, beverage type), persistent from the processing screen.
- Verdict region at the top of the working area — recommendation label, icon, and compact summary of pass / review / fail counts.
- Field checklist — ordered rows, each with field name, application value, extracted value, status, and severity; each row expandable in place; only one expanded at a time; expanded panel carries summary, explanation, confidence indicator, citations, and (when relevant) a comparison block.
- Government warning row expanded panel — named sub-checks, character-aligned comparison with visibly marked differences, confidence, citations; structurally distinct from ordinary rows.
- Cross-field checks section — separate heading, same row behavior as the checklist; renders even when empty (neutral one-line explanation).
- Action bar at the end of the working area — primary action to start a new review; secondary action to export results.
- Persistent privacy assurance that reinforces the reviewer's trust that nothing is stored.

### Standalone-mode variant of the results screen

- Same structure, with an info band between the counts and the checklist announcing standalone mode in plain language.
- Checklist with the application-value column removed; extracted value and status only.
- Cross-field checks section: application-dependent rows collapsed into a neutral skip explanation; rules that apply without application data still render normally.
- Action bar includes a "run full comparison" action that returns the reviewer to the intake screen with extracted values pre-filled.

### No-text-extracted variant of the results screen

- Same page frame and pinned image context.
- Verdict region replaced by a neutral advisory band with plain-language explanation.
- Checklist and cross-field section hidden by default.
- Two clear actions: try another image, and continue with caution.

## 5. Required states and variations to render

Please render each of the following as a distinct screen or state so the returned Stitch assets cover all of them:

- **Results — approve verdict, all rows pass, no expanded row.** The "clean label" state. The reviewer's happy path.
- **Results — review verdict, one row expanded (cosmetic comparison).** Row is a cosmetic mismatch (e.g., a casing difference between the application value and the extracted value). Expanded panel shows the comparison block so the "different-case" kind of difference is visibly distinct from a "different-value" kind of difference.
- **Results — reject verdict, government warning row expanded.** The densest and most important state. Sub-check list visible, character-aligned comparison visible with multiple kinds of differences marked (wrong characters, missing characters, wrong capitalization), confidence indicator visible, citations visible.
- **Results — reject verdict, cross-field check failure expanded.** Example: a wine row set where vintage is present and appellation is missing. One cross-field row expanded showing its evidence.
- **Results — low-confidence variant.** Verdict is `review`, banner shows the low-confidence secondary line, multiple rows show visibly weaker confidence fills.
- **Results — standalone-mode variant.** Info band visible, application-value column absent, cross-field skip line visible, "run full comparison" action visible in the band and in the action bar.
- **Results — no-text-extracted variant.** Verdict region replaced by the neutral advisory band; checklist hidden; two recovery actions visible.
- **Optional: row-focused-via-keyboard state.** Show what the focused row looks like (visible focus, no mouse hover). Optional but helpful — accessibility is a first-class concern.

## 6. Copy anchors

Use these exact strings verbatim. They are product content, not placeholder text.

Section and screen anchors:

- Results heading: `Results`
- Section heading: `Cross-field checks`
- Cross-field empty state: `No cross-field checks apply to this label.`
- Standalone info banner: `Standalone mode — no application data provided. Extracted values are shown below.`
- Standalone action: `Run Full Comparison`
- Skipped-cross-field explanation: `Cross-field checks requiring application data were skipped. Run Full Comparison to include them.`
- No-text heading: `We couldn't read enough text from this image.`
- No-text body: `The photo may be too blurry, too dark, or cropped. Your inputs are still here — nothing was saved.`
- No-text actions: `Try another image`, `Continue with caution`

Verdict banner copy:

- Approve headline: `Recommend approval`
- Review headline: `Recommend manual review`
- Reject headline: `Recommend rejection`
- Low-confidence secondary: `Low extraction confidence — review carefully.`
- Blocker secondary template (render a representative example): `Government warning is the deciding check.`

Counts (render with example numbers):

- `Pass 8`
- `Review 1`
- `Fail 1`

Field row labels (use in the checklist):

- `Brand name`
- `Fanciful name`
- `Class / Type`
- `Alcohol content`
- `Net contents`
- `Applicant name & address`
- `Origin`
- `Country`
- `Formula ID`
- `Appellation`
- `Vintage`
- `Varietals`
- `Government warning`

Cross-field check labels (use one or more in the section):

- `Same field of vision (brand / class / alcohol content)`
- `Vintage requires appellation`
- `Imported country present`
- `Varietal percentage totals 100%`
- `ABV format permitted for beverage type`

Status labels: `Pass`, `Review`, `Fail`.

Severity labels (shown in expanded panel only): `Blocker`, `Major`, `Minor`, `Note`.

Expanded-panel section labels (ordinary rows):

- `What the system found`
- `Confidence`
- `Citations`
- `Comparison`

Warning row expanded-panel section labels:

- `Sub-checks`
- `Required text`
- `Extracted from label`
- `Confidence`
- `Citations`

Sub-check row labels (render in this order inside the warning panel):

- `Warning text is present`
- `Warning text matches required wording`
- `Warning heading is uppercase and bold`
- `Warning is a continuous paragraph`
- `Warning is legible at label size`

Representative sub-check reason text (use these as realistic examples in the reject-verdict warning-row state):

- `Meets this requirement.`
- `Extracted text reads "Government Warning." Required wording begins with "GOVERNMENT WARNING:".`
- `Heading appears in mixed case.`

Action bar:

- Primary: `New Review`
- Primary tooltip (keyboard): `Press N to start a new review.`
- Secondary: `Export Results`
- Secondary (standalone mode only, placed before the primary): `Run Full Comparison`

Persistent privacy assurance (present on results as on intake and processing):

- `Nothing is stored. Inputs and results are discarded when you leave.`

## 7. Feelings and intents

Aim for:

- Calm, authoritative, evenly calibrated across positive, ambiguous, and negative verdicts.
- Information-dense without being cluttered; the verdict, the counts, and the first few checklist rows should be readable without scrolling on a standard desktop viewport.
- Legible for older reviewers under fluorescent office lighting; generous type; high contrast.
- Depth-on-demand: the surface rewards a reviewer who wants to go deep (especially on the government warning) without burdening one who only needs the verdict.
- Continuity with the intake and processing screens — the same page frame, the same pinned image context, the same top identification region.
- Stable layout as rows open and close, as long warning text appears in the diff, and as the view switches between comparison and standalone.
- Legible for a colorblind reviewer: every verdict, status, severity, confidence level, and diff-difference-kind reads the same way without color.
- Trust-inspiring: the system is showing its work, not declaring outcomes.

Avoid:

- Consumer-app warmth, celebration, or alarm.
- Marketing or promotional tone; "success!" framing for approvals; "error!" framing for rejections.
- Startup or SaaS analytics aesthetics — dashboards with decorative charts, progress donuts, animated counters.
- "AI magic" imagery, confidence as a brand halo, or any implication that the system decides rather than assists.
- Decorative motion. No celebratory confetti on approve. No shaking or pulsing on reject. No loading shimmer on the results surface — the results are already here.
- Hero illustrations, stock photography, mascots, emoji, or decorative gradients.
- Any impression that results were saved, queued, emailed, or shared. The only export action is reviewer-initiated.

## 8. Returned Stitch references

Returned by the user on 2026-04-13 as six inline HTML artifacts, saved under `docs/specs/TTB-102/stitch-refs/`:

- `stitch-refs/results-approve.html` — approve verdict, checklist in table layout, no expanded row, cross-field empty state.
- `stitch-refs/results-review-cosmetic.html` — review verdict (amber banner), `Brand name` row expanded with Application / Extracted comparison block and confidence meter.
- `stitch-refs/results-reject-warning.html` — reject verdict with 8/0/1 counts, government warning row expanded with sub-check list (left) + confidence panel (right) and a character-aligned diff block below.
- `stitch-refs/results-reject-cross-field.html` — reject verdict (no counts), `Vintage requires appellation` cross-field row expanded with Summary / Explanation / Citations.
- `stitch-refs/results-standalone.html` — standalone info band with inline `Run Full Comparison` link, three-column table with application-value column removed, cross-field skip explanation, action bar at bottom.
- `stitch-refs/results-no-text.html` — neutral advisory band replacing the verdict with `Try another image` and `Continue with caution` action cards.

A low-confidence variant was not returned — it will be constructed from the same primitives (verdict banner in `review` mode, confidence meters at amber/red thresholds) during implementation and is not a blocker.

### Visual direction chosen by Stitch (to preserve)

- **Palette:** same Material-You tokens as `TTB-101` — warm off-white `background` (`#f9f9f8`), near-black `on-surface`, slate `primary`, forest `tertiary` (for success/pass), brick `error` (for fail), quiet blue `secondary` (for info/standalone banner). Container surfaces use the `surface-container`/`surface-container-low`/`surface-container-lowest`/`surface-container-high` family consistently.
- **Typography:** Public Sans (headline), Work Sans (body), Inter (labels), IBM Plex Mono (data/diff). Matches `TTB-101`.
- **Layout motifs:**
  - Verdict banner is a full-width horizontal bar with a left accent stripe in the signal color, icon + headline on the left, counts on the right. Use this motif for all three verdicts.
  - Counts render as three small tiles with the big number and the word (`Pass` / `Review` / `Fail`) inline on the right of the banner.
  - Field rows in non-expanded state render as a table row with status as a right-aligned pill.
  - Expanded evidence panels use a two-column grid (summary/explanation on the left, confidence + citations on the right).
  - Warning expanded panel keeps the two-column grid for sub-checks + confidence, and adds a full-width diff block below.
  - Standalone info band uses the `secondary-container` tint with an inline `Run Full Comparison` anchor.
  - No-text advisory band uses a left-accent in `secondary` with two action cards.
- **Iconography:** Material Symbols Outlined throughout (verified_user / warning / error for the three verdicts; check / close for sub-checks; chevron_right / expand_more for row toggles). Acceptable.
- **Row accent:** left-colored border on each row/section by status (`tertiary` / `secondary` / `error`). Preserves the "signal color is rare and intentional" principle.

### Deviations from the brief to normalize during implementation

Stitch drifted on product shape even while preserving visual language. Implementation restores the canonical behavior:

1. **Top identification region — app name and subtitle.** Stitch rebranded the app to "Industrial Compliance" with a `Dashboard / Inventory / Archive` horizontal nav. The `TTB-101` frozen shell requires `TTB Label Verification Assistant` with subtitle `AI-assisted compliance checking`. Restore verbatim. Remove the Stitch nav entirely.
2. **Mode toggle.** `TTB-101` frozen shell includes `Single | Batch` toggle. Stitch removed it. Restore.
3. **Side navigation.** Stitch added a left sidebar with avatar, `Review Panel`, `Batch #829-X`, `Context / Metadata / History / Assets / Chain of Custody / Support / Documentation / Submit Verdict`. Brief §3 requires the same page frame from intake/processing — which has no sidebar. Remove the sidebar entirely.
4. **Top-right `Run Audit` / `Submit Verdict` / `Export` / `notifications` / `settings` buttons.** None are in the brief. Remove.
5. **Pinned image column.** Brief §4 and `TTB-101` handoff constraint 13 require a pinned left column carrying the label thumbnail, filename, size, and beverage-type pill — the same one used on the processing screen. Stitch variously put the thumbnail in an avatar slot, in a right rail, or removed it entirely. Restore the pinned left column on every results variant (including standalone; in no-text it stays visible with the submitted image).
6. **Verdict banner secondary copy.** Canonical copy per brief §6:
   - Approve headline: `Recommend approval`. Stitch added secondary `Final Analysis Complete`. Drop the secondary; leave the banner clean unless low-confidence applies.
   - Review headline: `Recommend manual review`. Stitch added `Found 1 minor discrepancies requiring human verification.` Drop; the counts communicate that.
   - Reject-warning headline: `Recommend rejection`. Stitch added `Final analysis identifies critical regulatory non-compliance in government warning statements.` Replace with the brief's blocker-secondary template: `Government warning is the deciding check.`
   - Reject-cross-field: Stitch added `Audit failed due to high-severity cross-field regulatory inconsistency.` Replace with the blocker-secondary template referencing the failing cross-field check, e.g. `Vintage requires appellation is the deciding check.`
7. **Counts must render on every verdict.** Stitch omitted counts on the reject-cross-field banner and replaced them with a `Violation Detected` pill. Restore the three-tile counts on every verdict.
8. **Status label casing.** Brief §6 anchors are exactly `Pass`, `Review`, `Fail`. Stitch produced `PASSED`, `FORMAT PASS`, `FORMAT FAIL`, `CRITICAL FAIL`, `REVIEW` (uppercase). Normalize to the canonical capitalization (Title case for the status word inside the badge). Uppercase micro-labels are allowed for column headers and section labels, not for the status word itself.
9. **Action rows inside expanded panels.** Stitch added `IGNORE` and `APPROVE MATCH` action buttons inside the review-casing expanded panel. Brief §3 and §4.5 say the expanded panel is read-only evidence (summary, explanation, confidence, citations, comparison). Remove these buttons.
10. **Reject-cross-field footer.** Stitch shows `Previous Batch` on the left and `Manual Review Required` / `Confirm Rejection` on the right. Brief action bar is `Export Results` + `New Review` (primary) — no batch navigation, no reviewer-decision buttons. Restore canonical action bar.
11. **Right-rail `Audit Metrics` / `Batch Details` / `Audit Instance ID` / `Last Validated` / `Auditor Assigned` / `Label Evidence` / `Analysis Metrics`.** None are in the brief. Remove all right-rail panels; the pinned left image column is the only context chrome.
12. **Standalone row content.** Stitch populated the standalone table with fake fields (`Registration ID`, `Facility Coordinates`, `Thermal Signature`, `Operator Signature Date`, `NULL_PTR_EXCEPTION`). Use canonical TTB label fields from brief §6 (`Brand name`, `Class / Type`, `Alcohol content`, `Net contents`, etc.) populated from the extracted values. Never show pseudo-error text as a cell value.
13. **Standalone info banner headline.** Stitch uses `Advanced Validations Suspended` as a sub-heading. Brief §6 canonical copy is `Standalone mode — no application data provided. Extracted values are shown below.` and the skip explanation is `Cross-field checks requiring application data were skipped. Run Full Comparison to include them.` — use those verbatim.
14. **Standalone decorative cards.** Stitch adds `Extraction Integrity 94.2%`, `Metadata Density High`, `Source Latency 12ms OPTIMAL` below the action bar. Not in brief. Remove.
15. **Privacy assurance.** The canonical `Nothing is stored. Inputs and results are discarded when you leave.` microcopy must remain visible on every results variant. Stitch dropped it. Restore (anchor it at the bottom of the pinned image column so it persists across intake → processing → results).
16. **Review banner palette.** Stitch used raw amber hex (`#FFF8E1`, `#F59E0B`, `#92400E`, `#B45309`) because the `TTB-101` theme has no caution token. Implementation adds `caution`, `caution-container`, `on-caution-container` tokens to `tailwind.config.js` and documents them in `docs/design/INDUSTRIAL_PRECISION_THEME.md`, then replaces the raw hex with theme tokens. Zero raw hex in `src/client/**`.
17. **No-text variant chrome.** Stitch renders `Original Image Capture`, `Batch #829-X-442`, `14:22 GMT-5`, a `Diagnostic Metadata` / `SYSTEM_LOG_v2.4` / `LOW_CONTRAST_NOISE` / `OCR Confidence Score 12.4%` panel. Brief §5.7 defines a simple no-text state: neutral advisory band + two action cards. Remove the system-log panel; keep the two-card recovery pattern.
18. **Warning diff — positional alignment.** Stitch's diff renders canonical and extracted as `whitespace-nowrap` single lines with a `GOVERNMENT` vs. `Government Warning:` token swap and a late `X`-for-`G` mid-word example. Implementation does a real character-aligned diff: both lines monospace, same column width, each character positionally aligned, with differences tagged by kind (`wrong-character`, `missing`, `wrong-case`) and reinforced with a legend + per-segment `aria-label` (brief §7 accessibility). The visual highlight style (light tint, bold character) is preserved; the alignment logic is the implementation normalizing correctness.
19. **Warning sub-check `OCR Confidence Index` label.** Canonical label in the warning panel is `Confidence` (brief §6). Rename. Keep the percentage meter.
20. **Row expand animation.** Stitch uses `expand_more` and a 90° rotate transform — acceptable. Implementation honors `prefers-reduced-motion` by skipping the rotate transition.
21. **Approve banner icon.** Stitch uses `verified_user` — acceptable. Keep.
22. **Reject banner icon.** Stitch uses `gavel` on one variant and `shield_with_heart` on another. Normalize to a single icon (`cancel` or `block`) so the reject state reads consistently across variants.
23. **Cross-field collapsed row copy** (`Alcohol Content vs. Class` passing). Canonical name per brief §6 is `Same field of vision (brand / class / alcohol content)` or the equivalent cross-field labels. Use canonical labels, not Stitch's shorthand.
24. **Field row — collapsed row shows application + extracted values inline.** Stitch's approve variant renders values in table cells in the collapsed state. That's consistent with brief §4.4 (collapsed row has application value, extracted value, status). Preserve this in the approve layout. For the review and reject variants, the collapsed row shows only the field name + status (simpler) — this is fine for a row that is about to expand, but the canonical design per spec §4.4 includes values in the collapsed row. Implementation uses the Approve-variant shape (values visible in collapsed row) for all variants to maintain consistency with the brief.
25. **Keyboard-focused row state.** Not included in returned assets (optional in brief §5). Implementation handles via `:focus-visible` using the shell's existing focus-ring utility.

Implementation preserves the Stitch visual skeleton (palette, typography, banner/accent/diff motifs, icon choices) and normalizes the product shape (shell continuity, canonical copy, pinned image column, correct field names, no sidebar, no reviewer-action buttons inside evidence panels, consistent counts, persistent privacy assurance, real character-aligned diff, token-based Review palette).
