---
story: TTB-102
title: single-label results, warning evidence, and standalone UI
owner: Claude (UI lane)
status: draft — pending Stitch references
updated: 2026-04-13
---

# UI Component Spec — TTB-102 single-label results, warning evidence, and standalone

## 1. Problem

`TTB-101` proved the intake and processing surface. The results surface is where the product earns trust or loses it. A reviewer finishing a single-label review needs three things at once, in the first second:

1. **The verdict** — approve, review, or reject — plus its headline evidence.
2. **The field-by-field checklist** — what passed, what the system flagged, and what it judged a violation.
3. **Enough depth on demand** — especially on the government warning — that the reviewer does not have to read the label word by word.

The story also owns two secondary modes that share the same results frame: **standalone mode** (no application data provided) and **recoverable-result states** (low confidence, no text extracted). Both must feel like first-class states, not broken variants.

Out of scope for this story: batch results, batch dashboard, `Export Results` functionality beyond the button surface (the button may be wired or deferred in a later story), and PDF-specific rendering quirks beyond what raster handling already supports.

## 2. Users & use cases

Same primary users as `TTB-101`:

- **Jenny (junior reviewer):** needs the checklist to act as a digital version of her paper checklist. Wants each row to explain itself in plain language, with citations when she has to defend a judgment to a colleague.
- **Dave (senior reviewer):** runs 50 reviews a day. Needs the verdict + counts in the first glance and zero friction to expand the one or two rows that matter. Wants the warning diff to be instantly readable, not ornamental.
- **Janet (high-volume reviewer):** wants keyboard navigation across rows and a single keystroke to start the next review.
- **Sarah / Marcus (leadership, procurement audience):** will watch a demo. The first impression of the results screen sells the tool.

Core use cases:

- Read the verdict and decide whether to approve, review, or reject.
- Scan the checklist, expand the rows that matter, read the evidence, read the citation.
- Compare the canonical government warning against the extracted text character by character.
- Run a partial review without application data and still get useful output.
- Receive a clear, calm response when the image was too blurry to extract anything useful.
- Start the next review in one keystroke.

## 3. UX flows

### 3.1 Happy path — comparison mode

1. Processing completes. The dashed placeholder from `TTB-101` is replaced by the results view inside the same page frame.
2. The pinned image column remains (thumbnail, filename, beverage type). The working area now shows the verdict banner at the top.
3. Reviewer reads banner + counts, scans the field checklist, optionally expands one or two rows.
4. Reviewer clicks **New Review** to reset to a clean intake, or **Export Results** (if wired) to export the session payload.

### 3.2 Happy path — standalone mode

1. Reviewer submitted without application data in `TTB-101`.
2. Results view renders the standalone variant: the mode banner announces standalone mode, the field rows show the **extracted value** column only (no application value column), and the action bar includes **Run Full Comparison** as a secondary-primary action.
3. Clicking **Run Full Comparison** returns to intake with the extracted values pre-filled in the form; the reviewer can edit and re-verify.
4. Otherwise the flow ends with **New Review** as in comparison mode.

### 3.3 Low-confidence result

1. The extraction pass returned a valid report but with global or per-field confidence below the trust threshold.
2. Banner shows `Review` with an explicit confidence note ("Low extraction confidence — review carefully.").
3. Affected rows render their confidence meter in amber or red; unaffected rows remain trustworthy.
4. Reviewer can expand the flagged rows to see the confidence rationale; nothing else changes.

### 3.4 No-text-extracted (recoverable)

1. The extraction pass returned too little text to produce a meaningful result (blurry, under-exposed, unsupported photo angle).
2. Results view renders a dedicated no-text state: the verdict banner is replaced by a neutral advisory ("We couldn't read enough text from this image."), the field list is hidden, and two actions appear: **Try another image** (returns to intake with fields intact but the image cleared) and **Continue with caution** (renders whatever partial evidence was produced, with every row flagged as low confidence).
3. Privacy copy remains visible.

### 3.5 Row expansion

1. Reviewer clicks a collapsed row (or presses Enter on a focused row).
2. The row expands in place; any previously-expanded row auto-collapses.
3. The expanded panel animates open in under 300ms (or instantly under `prefers-reduced-motion`).
4. Keyboard: Escape collapses the open row; Up/Down arrows move focus between rows; Enter toggles expansion on focus.

### 3.6 Government warning detail (special case)

1. The warning row's expanded panel is larger and structured differently from other rows:
   - Top: sub-check summary (five rules: presence, exact text, uppercase prefix bold, continuous paragraph, legibility). Each sub-check has its own status badge.
   - Middle: character-level diff between the canonical required text and the text extracted from the label. Monospace, character-aligned.
   - Bottom: confidence meter and citations.
2. The diff handles long text without wrapping mid-word where possible; wrapping preserves position alignment.
3. Scrolling the diff never scrolls the page; only the diff block scrolls.

### 3.7 Cross-field checks

1. Below the field checklist, a separate **Cross-field checks** section lists dependency rules (wine: vintage requires appellation; imported: country required; spirits: same field of vision; varietal totals).
2. Each cross-field row has the same status + severity + expandable evidence shape as field rows.
3. If no cross-field checks apply, the section renders with a neutral "No cross-field checks apply to this label" state rather than disappearing — the section's presence itself is evidence that the system ran those checks.

### 3.8 Reset and restart

1. **New Review** is the primary action in the results action bar.
2. Clicking it clears the image, fields, beverage type, and result, and returns to the empty intake. No confirmation prompt unless the user has pending partial edits (inherited from `TTB-101`).
3. Keyboard shortcut `N` (documented in a tooltip on the button) fires **New Review** from anywhere in the results view, matching Janet's high-volume flow.

### 3.9 Failure → results edge case

The `TTB-101` failure variant (processing error) is independent and does not enter the results view. Do not collapse failure into results; keep them separate surfaces.

## 4. IA / layout

The page frame remains the same as `TTB-101`:

- Title bar + Single/Batch toggle (unchanged).
- Main content area, 1200px max width, horizontally centered.
- Pinned image column on the left (thumbnail, filename, beverage type pill) — same column position as processing. On desktop, this column persists; on narrower viewports it collapses above the results working area.

### 4.1 Desktop (≥1024px)

Two-column content area inside the page frame:

- **Left column (≈30% width):** pinned image context (persists from processing). Same size and position as in `TTB-101` processing.
- **Right column (≈70% width):** results working area, stacked vertically:
  1. **Verdict banner** — full-width within the right column.
  2. **Counts summary** — inline below the banner, as a small set of three pills (Pass / Review / Fail) with counts.
  3. **Standalone banner** — appears between counts and the field list only in standalone mode.
  4. **Field checklist** — ordered rows, expandable, one expanded at a time.
  5. **Cross-field checks** — section heading plus a second list of rows using the same row component.
  6. **Action bar** — right-aligned **New Review** (primary), **Export Results** (secondary), and in standalone mode **Run Full Comparison** appears before **New Review** with secondary-primary weight.

### 4.2 Tablet (768–1023px)

Single-column stack: image column → verdict banner → counts → standalone banner (if applicable) → field list → cross-field checks → action bar. Image column collapses to a compact horizontal bar (thumbnail + filename + beverage type pill in one row).

### 4.3 Mobile (<768px)

Same stack. Action bar becomes sticky at the bottom of the viewport. Field rows may stack label/value vertically in their collapsed form to preserve readability. The warning diff scrolls horizontally when the monospace width exceeds the viewport.

### 4.4 Row anatomy (collapsed)

A horizontal flex row with four regions:

1. **Field label** (left, fixed min-width)
2. **Application value** (middle-left) — hidden in standalone mode
3. **Extracted value** (middle-right) — monospace or data font
4. **Status** (right) — status badge + severity dot + chevron

### 4.5 Row anatomy (expanded)

The row label bar remains visible (as a sticky header within the row); below it a panel with:

- Summary sentence (one line)
- Explanation paragraph (plain English, no jargon)
- Confidence meter (thin bar + numeric label)
- Citations (one per line, small type, with an external-link glyph if clickable)
- Optional comparison evidence (for fuzzy/cosmetic differences: shows canonical form vs extracted form with highlighting)

### 4.6 Warning row expanded (special)

Same sticky header; panel contains:

- Sub-check table (five rows, each with its own status badge and one-line explanation)
- Diff block (monospace, two stacked labeled text bodies: "Required text" above, "Extracted from label" below), character-level highlighting per `MASTER_DESIGN`
- Confidence meter and citations below the diff

## 5. States

### 5.1 Verdict banner

- **Approve:** green tint, checkmark icon, "Recommend approval" headline, count summary right-aligned.
- **Review:** amber tint, warning-triangle icon, "Recommend manual review" headline, count summary. Secondary line when low confidence: "Low extraction confidence — review carefully."
- **Reject:** red tint, X-circle icon, "Recommend rejection" headline, count summary. Secondary line when a specific blocker drove it: "{Field} is the deciding check."
- **Standalone banner (separate, not a verdict variant):** quiet info band between counts and field list, not tinted in a status color — uses the Info/Blue accent only. Copy: "Standalone mode — no application data provided. Extracted values are shown below." Primary action within the banner: **Run Full Comparison** (returns to intake with extracted values pre-filled).
- **No-text:** replaces the verdict banner entirely with a neutral advisory band and two actions (see 5.7).

### 5.2 Counts summary

Three pills in a row: `Pass {n}`, `Review {n}`, `Fail {n}`. Each pill uses the corresponding status color as a very light background with the full status color for the number. Empty categories (e.g., no `Fail`) are still shown with `0` so the reviewer sees that the system ran those checks.

### 5.3 Field row — collapsed

- **Pass:** default type, green status badge, no extra tint.
- **Review:** amber status badge, row left-border in amber, severity dot right-aligned next to the badge.
- **Fail:** red status badge, row left-border in red, severity dot right-aligned.
- **Focused:** focus ring on the entire row (not just chevron); pointer cursor.
- **Hover:** subtle background darkening (inherited from `MASTER_DESIGN`).
- **Expanded parent:** chevron rotates; row header gains a subtle nesting indicator so the expanded panel reads as continuation.

### 5.4 Field row — expanded panel

- **Low confidence:** confidence meter fills to the numeric value with color threshold (green ≥90, amber 70–89, red <70). Meter is a thin bar with the numeric label to the right.
- **Comparison evidence (fuzzy/cosmetic):** two labeled lines, "Application" and "Extracted," with the differing characters highlighted in amber (case mismatch) or red (different character). Matches existing diff rules in `MASTER_DESIGN`.
- **No details to show:** if the row is `pass` with no comparison needed, the expanded panel shows a single-line confirmation ("Matches the application value. Confidence 98%.") with citations.
- **No extracted value:** expanded panel explains "We couldn't read this field from the label." — never technical.

### 5.5 Government warning row — expanded panel

- **All sub-checks pass:** panel opens with a success headline ("Warning text meets all five sub-checks.") and the sub-check table. Diff block still renders so the reviewer can verify, but without any red/amber highlighting.
- **Text defect (e.g., `spirit-warning-errors`):** sub-check table shows specific failing checks (exact text, uppercase prefix bold). Diff block highlights character-level differences. Each failing sub-check includes a one-sentence explanation in plain English (e.g., "Required: GOVERNMENT WARNING:. Extracted: Government Warning.").
- **Missing warning entirely:** diff block collapses to a single line ("No warning text detected on this label.") with a red status and a clear citation.
- **Low confidence:** confidence meter at the bottom tilts amber; sub-checks that depended on uncertain extraction show a neutral "inconclusive" badge rather than pass/fail.

### 5.6 Cross-field checks section

- **Populated:** section heading + one or more rows, same row component as field checklist.
- **Empty:** section heading + neutral single-line state ("No cross-field checks apply to this label."). The section always renders — its presence is evidence that the system ran those checks.
- **Row states:** same as §5.3 and §5.4.

### 5.7 No-text-extracted state

- Replaces verdict banner with a neutral advisory band (icon + headline + body + two actions).
- Headline: "We couldn't read enough text from this image."
- Body: "The photo may be too blurry, too dark, or cropped. Your inputs are still here — nothing was saved."
- Actions: **Try another image** (primary — returns to intake with form fields intact but image cleared) and **Continue with caution** (secondary — renders whatever partial evidence exists, with every field row flagged low confidence; verdict defaults to `review`).
- Pinned image column still shows the image the reviewer submitted.

### 5.8 Standalone mode

- Verdict banner shows a real recommendation (often `review` because less evidence is available).
- Counts pill row visible as usual.
- Info band below counts: "Standalone mode — no application data provided. Extracted values are shown below." + `Run Full Comparison` button (secondary-primary weight).
- Field rows: **Application value** column removed; extracted value column takes its place.
- Cross-field checks section: only rules that apply without application data render; application-dependent rules collapse into a single line ("Cross-field checks requiring application data were skipped. Run Full Comparison to include them.").

### 5.9 Action bar

- **Comparison mode:** `New Review` (primary), `Export Results` (secondary). `N` keyboard shortcut documented on the primary button.
- **Standalone mode:** `Run Full Comparison` (secondary-primary), `New Review` (primary), `Export Results` (secondary). `Run Full Comparison` sits to the left of `New Review` so the reading order flows "deepen this review → discard and start fresh."
- **No-text-extracted state:** `Try another image` (primary), `Continue with caution` (secondary). Standard action bar is hidden until the reviewer chooses.
- **Export Results:** button exists in the UI; the backend wiring for export may be deferred. If deferred, clicking the button shows a small inline tooltip explaining this ("Export is enabled when the live pipeline lands.") — do not show a broken download.

### 5.10 Reduced motion

All row expansion, banner settle, and confidence meter fill animations drop to instant state swaps. The expanded panel appears without height transition. Focus ring and hover states are unchanged.

## 6. Copy & microcopy

Headings and labels:

- Results heading: `Results`
- Section heading: `Cross-field checks`
- Section heading (no-op state): `Cross-field checks`
- Cross-field empty body: `No cross-field checks apply to this label.`
- Standalone info banner: `Standalone mode — no application data provided. Extracted values are shown below.`
- Standalone action: `Run Full Comparison`
- No-text heading: `We couldn't read enough text from this image.`
- No-text body: `The photo may be too blurry, too dark, or cropped. Your inputs are still here — nothing was saved.`
- No-text actions: `Try another image`, `Continue with caution`

Verdict banner copy:

- Approve headline: `Recommend approval`
- Review headline: `Recommend manual review`
- Reject headline: `Recommend rejection`
- Low-confidence secondary: `Low extraction confidence — review carefully.`
- Blocker secondary template: `{Field} is the deciding check.`

Counts pills:

- `Pass {n}`
- `Review {n}`
- `Fail {n}`

Field row labels (match evidence contract language — exact extracted values come from backend):

- `Brand name`
- `Fanciful name`
- `Class / Type`
- `Alcohol content`
- `Net contents`
- `Applicant name & address`
- `Origin`
- `Country` (imported only)
- `Formula ID`
- `Appellation` (wine only)
- `Vintage` (wine only)
- `Varietals` (wine only)
- `Government warning`

Cross-field check labels (populate as the rules land — names below are the UI anchors):

- `Same field of vision (brand / class / alcohol content)`
- `Vintage requires appellation`
- `Imported country present`
- `Varietal percentage totals 100%`
- `ABV format permitted for beverage type`

Status badges: `Pass`, `Review`, `Fail` (never `FAIL`, `OK`, `WARN`).

Severity labels (shown in expanded panel, not in collapsed row): `Blocker`, `Major`, `Minor`, `Note`.

Expanded-panel section labels:

- `What the system found`
- `Confidence`
- `Citations`
- `Comparison` (only when comparison evidence is shown)

Warning row expanded-panel labels:

- `Sub-checks`
- `Required text`
- `Extracted from label`
- `Confidence`
- `Citations`

Sub-check row labels (exact):

- `Warning text is present`
- `Warning text matches required wording`
- `Warning heading is uppercase and bold`
- `Warning is a continuous paragraph`
- `Warning is legible at label size`

Sub-check status copy (inside the row, one-line explanations — these are templates, backend fills in specifics):

- Pass: `Meets this requirement.`
- Review: `Inconclusive — extraction confidence is low.`
- Fail: `{plain reason}.`

Action bar:

- Primary: `New Review`
- Primary tooltip (keyboard): `Press N to start a new review.`
- Secondary: `Export Results`
- Secondary tooltip when deferred: `Export is enabled when the live pipeline lands.`
- Standalone secondary-primary: `Run Full Comparison`

Copy principles (inherited from `TTB-101`):

- No technical jargon in user-visible strings.
- Never say "AI" without qualifying.
- Singular, direct instructions.
- No exclamation marks.

## 7. Accessibility, privacy, performance constraints

Accessibility:

- Body text 16px minimum; supporting text 14px; status labels never below 14px.
- Every status is reinforced by icon + label; color is never the sole signal.
- Row is a real button (or has `role="button"` with full keyboard semantics). Chevron rotation is decorative — the row's `aria-expanded` state is authoritative.
- Expanded panel is not a modal; it is inline content with a heading-level structure that screen readers can navigate.
- Warning diff: each highlighted character has an `aria-label` describing the difference ("missing character", "wrong capitalization"). If that becomes verbose, the diff block has a live-region summary ("3 characters differ from required text") rendered before the diff.
- Focus management: when the reviewer expands a row, focus moves to the first interactive element in the panel (or to the panel heading if none). When they collapse, focus returns to the row header.
- Keyboard:
  - `Tab` enters the checklist; arrow keys move between rows.
  - `Enter` toggles the focused row.
  - `Escape` collapses the open row.
  - `N` triggers `New Review` from anywhere in the results view.
- Reduced motion: honored (see 5.10).
- Contrast: WCAG AA minimum on all text and signal elements; warning diff highlighting must remain readable through the tint.

Privacy:

- Privacy microcopy remains visible at the bottom of the pinned image column on the results view too, as a persistent reminder: `Nothing is stored. Inputs and results are discarded when you leave.`
- UI must not log result values (field values, confidence numbers, citations) to console, storage, or analytics. Document as a frozen constraint for Codex in the handoff.
- Export action, when wired, must operate on the in-memory report only; no intermediate upload or persistent share link.
- The image object URL remains the one created during intake; it is revoked on `New Review` (matching `TTB-101`).

Performance:

- Rendering the results view should not introduce perceptible delay after the processing terminal state. Target: results view first paint under 150ms on a mid-tier laptop.
- Row expansion under 300ms; reduced-motion forces instant swap.
- Confidence meter fill should be CSS-only (no JS timing loop) so many rows rendering simultaneously do not stall.
- Warning diff rendering must remain interactive with up to 1,000 characters of canonical text. Use non-blocking virtualization only if profiling shows real work above that threshold; do not pre-optimize.
- Keep component trees small. Do not introduce memoization or virtualization speculatively.

## 8. Data and evidence needs from backend

These requirements feed the Codex handoff and are the contract surface the results view will assume.

### 8.1 Response shape

- The UI expects a `VerificationReport` conforming to `src/shared/contracts/review.ts`. That shape is already present in the repo; TTB-201 will expand it. The additions TTB-102 depends on:

```ts
// Additions/expansions TTB-102 assumes on VerificationReport
{
  mode: 'single-label',
  standalone: boolean,              // true when the reviewer provided no application data
  extractionQuality: {
    globalConfidence: number,       // 0..1
    state: 'ok' | 'low-confidence' | 'no-text-extracted',
    note?: string                   // optional plain-English context
  },
  counts: { pass: number, review: number, fail: number },
  crossFieldChecks: FieldReview[]   // same shape as checks, surfaced in the cross-field section
}
```

- `FieldReview` must carry, per the evidence contract for `TTB-002`:
  - `applicationValue?: string` (omitted or undefined in standalone mode)
  - `extractedValue?: string`
  - `comparison?: { status: 'match' | 'case-mismatch' | 'value-mismatch' | 'not-applicable', note?: string }`
  - `warning?` (only on the government-warning row) — see 8.2.

### 8.2 Warning evidence

On the `government-warning` field only, include:

```ts
warning: {
  subChecks: Array<{
    id: 'present' | 'exact-text' | 'uppercase-bold-heading' | 'continuous-paragraph' | 'legibility',
    label: string,         // canonical UI label (mirrors §6)
    status: VerificationStatus,
    reason?: string        // plain-English sentence for UI; no codes
  }>,
  diff: {
    required: string,      // canonical warning text, verbatim
    extracted: string,     // what was read from the label, verbatim
    segments: Array<{
      kind: 'match' | 'missing' | 'wrong-character' | 'wrong-case',
      fromIndex: number,
      toIndex: number
    }>
  }
}
```

### 8.3 Evidence requirements per row

- `summary` — one-line plain-English outcome.
- `details` — paragraph(s), plain English.
- `confidence` — 0..1.
- `citations` — ordered list of rule references.
- `severity` — `blocker | major | minor | note`.

### 8.4 Standalone mode

The backend returns `standalone: true` and omits application-comparison evidence for rows that depend on it. The UI does not fabricate missing application values. Cross-field checks that require application data are either returned with `status: 'info'` and a `note: 'Requires application data'` or are omitted; the UI handles both but prefers the explicit `info` form.

### 8.5 No-text-extracted

`extractionQuality.state === 'no-text-extracted'` is a first-class API state. `counts` may be zero across the board; `checks` may be empty. UI renders the dedicated no-text state. If `Continue with caution` is chosen, the UI calls a separate backend behavior (or reuses the last report) that returns whatever partial extraction exists with every field flagged `review`.

### 8.6 Error → results boundary

Errors surfaced during processing (network, timeout, adapter, validation) continue to use the `TTB-101` failure variant. The results view never receives a request-level error — it only receives `VerificationReport`. If Codex later needs to merge error display into the results view, route that change back to Claude.

### 8.7 Export payload (if wired)

If `Export Results` ships in this story, the payload is the same `VerificationReport` serialized to JSON, plus a small header containing timestamp, beverage type, standalone flag, and the image filename (never the image itself). No persistence on the server. UI initiates the download from in-memory state via a Blob URL that is revoked immediately after the download starts.

## 9. Frozen design constraints for Codex

When Codex wires live behavior, these results-view properties are fixed and must not be redesigned:

- Single-page shell and pinned image column identical in position and size to `TTB-101`.
- Two-column results layout at desktop; single-column stack below 1024px.
- Checklist-first results hierarchy: banner → counts → (standalone banner) → field rows → cross-field checks → action bar.
- Exactly one field row expanded at a time.
- Government warning row's expanded panel is a distinct structure (sub-checks + diff + confidence + citations). Non-warning rows use the standard evidence panel.
- Status vocabulary: `Pass`, `Review`, `Fail` (never other spellings/casings).
- Severity vocabulary: `Blocker`, `Major`, `Minor`, `Note`.
- Standalone mode is an information band plus a column-level change (no application value column), not a separate page.
- No-text-extracted is a dedicated state with its own actions, not a variant of the verdict banner.
- `Run Full Comparison` returns to intake with extracted values pre-filled; this is a UI behavior, not a separate backend route.
- `Export Results` button is present even if its wiring ships in a later story.
- Reduced motion honored.
- Theme tokens only; no raw hex in `src/client/**`.

Codex may change: actual backend payload encoding, streaming semantics, whether the post-processing response merges extraction + validator output into a single round-trip, and the transport for `Run Full Comparison` pre-fill (current UI plan is client-side reuse of the last report).

## 10. Open questions

1. **Export Results scope.** Ship the button wired (download the in-memory report as JSON) or ship the button with a deferred tooltip until Codex lands the export endpoint? Default proposal: ship wired to an in-memory JSON export so the demo is complete.
2. **`Run Full Comparison` pre-fill.** Does the UI simply copy extracted values into the form, or does the backend return a canonical "application-form-shaped" payload derived from extraction? Default: UI copies extracted values verbatim; backend provides them as plain strings matching the intake shape.
3. **No-text-extracted recovery path.** Does `Continue with caution` call a separate endpoint or reuse the last `VerificationReport` and just re-render? Default: reuse last report client-side.
4. **Row ordering.** Fixed by severity (blockers first), fixed by semantic group (identity → measures → origin → warning → wine-only), or configurable per reviewer preference? Default for this story: fixed by semantic group, within which `Fail` rows surface before `Review` and `Pass`.
5. **Warning diff wrap behavior.** On narrow viewports, do we horizontally scroll the diff or soft-wrap with position markers? Default: horizontal scroll on <768px, soft-wrap above that.
6. **Severity dot presence.** Do we show the severity dot on `Pass` rows (as a neutral `Note`) or suppress it? Default: suppress on `Pass`, show on `Review` and `Fail`.
7. **Standalone mode entry.** Triggered purely by absence of application fields, or a future explicit "Run standalone" affordance on intake? Default: absence-based for this story; explicit toggle deferred.

## 11. Eval scenario coverage

This story seeds a named result state for each of the six required scenarios in `evals/labels/manifest.json`, plus two additional UI-only demo states. All are accessible via the dev-only scenario picker in the header (inherited from `TTB-101`).

- `perfect-spirit-label` → verdict `approve`, counts biased to pass, no cross-field issues.
- `spirit-warning-errors` → verdict `reject`; `Government warning` row `fail`; expanded warning panel shows three sub-check failures (`exact-text`, `uppercase-bold-heading`, `continuous-paragraph`) and a diff highlighting title-case letters and missing colon.
- `spirit-brand-case-mismatch` → verdict `review`; `Brand name` row `review`; expanded panel shows a cosmetic comparison ("STONE'S THROW" vs "Stone's Throw") with wrong-case highlights.
- `wine-missing-appellation` → verdict `reject`; `Appellation` row `fail`; cross-field section shows `Vintage requires appellation` as `fail` with citation.
- `beer-forbidden-abv-format` → verdict `reject`; `Alcohol content` row `fail`; cross-field section shows `ABV format permitted for beverage type` as `fail` with plain-English explanation.
- `low-quality-image` → verdict `review`; global low confidence banner copy; multiple rows show amber confidence meters.
- `no-text-extracted` (UI-only) → renders §5.7 no-text state.
- `standalone-mode` (UI-only) → renders §3.2 / §5.8 standalone variant against a happy-path extracted set.

Seed payloads for these are added to `src/client/scenarios.ts` during implementation; no backend change is required for the mocks.
