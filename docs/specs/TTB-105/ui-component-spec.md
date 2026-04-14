# UI Component Spec — TTB-105

## Story

- Story ID: `TTB-105`
- Title: accessibility, trust copy, and final UI polish
- Parent: `TTB-004`
- Lane: Claude (UI polish) — engineering continues under `TTB-401`

## Problem

After `TTB-104` approval, the integrated product has every major surface in place. The remaining friction comes from small but impactful gaps: reviewers not finding the exit from the single-label Results view, status that might appear to rely on color, dense panels that get hard to read under office lighting, and occasional copy that slips into a marketing register. This story closes those gaps without redesigning any approved surface.

## Users and use cases

- **Primary: high-volume TTB reviewer.** Uses the tool dozens of times a day; every unnecessary click compounds.
- **Secondary: supervisor / procurement reviewer.** Uses the tool occasionally; has less muscle memory and needs every affordance to read as obvious on first use.
- **Secondary: demo viewer.** Scans the tool for two or three minutes; trust is won or lost in those first impressions.

Use cases closed by this story:

1. After a single-label review completes, find "back to intake" without having to try the primary button first. (Directly reported during `TTB-104` approval.)
2. Cancel a single-label review mid-processing without hunting for the link in a sidebar footer.
3. Read every compliance status with or without color.
4. Read the warning diff, batch triage table, and cross-field evidence comfortably at 100% zoom under fluorescent light.
5. Confirm, on every surface, that nothing is being stored.

## Polish items

### 1. Single-label Results — Back-to-Intake breadcrumb (user-reported)

- Add an additive breadcrumb nav above the `Results` component, mirroring the `TTB-104` drill-in shell pattern: edge-to-edge full-viewport width with `px-6 lg:px-8` padding, a bordered button at viewport left labeled `Back to Intake`, and a small privacy-anchor chip at viewport right.
- Do not edit `Results.tsx`. The nav is rendered in `App.tsx` above the `Results` call site when `view === 'results'`.
- `Back to Intake` uses the same hover-gradient promote as `TTB-104`'s `Back to Batch Results`, so it reads as a sibling pattern across the product.
- Keyboard reachability: first Tab stop on the Results view lands on `Back to Intake`. Esc anywhere outside a form field returns to intake (new shortcut; subject to the `TTB-102` shortcut-gating question).

### 2. Single-label Processing — promote Cancel

- The existing `Cancel review` text link in the Processing pinned column is hard to find. Promote it to a bordered button with the same weight as the new `Back to Intake` pattern, kept inside the pinned column.
- Copy unchanged (`Cancel review`).
- Keyboard reachability: Esc during Processing triggers Cancel (new shortcut; same gating question as above).

### 3. Status independence from color (audit)

- Verify every `Pass` / `Review` / `Fail` / `Info` / `Error` surface carries icon + text + color reinforcement. Existing components already meet this (per `TTB-102` handoff §13), but the audit confirms the guarantee extends to:
  - batch triage row status
  - stream row status in `BatchProcessing`
  - verdict banner in `Results` (reused via drill-in)
  - filter pill active state in the dashboard (uses text + background change, not color-only)

### 4. Dense-state legibility

- Warning character-aligned diff: confirm the diff stays readable at 100% zoom on a 1280px viewport. Fix any overflow without changing the layout.
- Batch triage table at 50 rows: confirm no horizontal compression of the `Status` column when the filename is long. Truncate filename with an ellipsis instead of wrapping.
- Cross-field checks: confirm the expanded evidence panel wraps long explanations without pushing sibling rows.

### 5. Trust copy review

Scan every surface for tone slips. The approved copy anchors already carry the right register, but any additions during earlier stories that slipped into marketing / celebratory / alarmist tone get flagged and normalized. Specific scan targets:

- All-pass terminal summary in `BatchProcessing` — should read `All {total} labels passed.` not `Great work!`
- All-fail terminal summary — should read `All {total} labels failed.` not `These labels need attention.`
- Export confirmation — should read `One download. JSON format. Nothing is stored on our servers.` not `Ready to export?`
- No-text-extracted state — should read as quietly advisory, not alarmed.

### 6. Keyboard reachability

Every interactive element reachable via Tab. Verify focus rings via `:focus-visible`. Fix any `tabindex="-1"` regressions.

### 7. Reduced motion

Any entry / exit transition or decorative animation added during earlier stories honors `prefers-reduced-motion`. The `BatchDashboard` row hover transform, the walker's hover-promote gradient, and the image preview overlay's backdrop-blur already respect the media query where applicable. Verify.

### 8. Privacy anchor visibility

Every main surface (intake, processing, results, standalone, no-text, batch intake, batch processing, batch dashboard, drill-in, export confirmation) carries the canonical line `Nothing is stored. Inputs and results are discarded when you leave.` once, in a stable place. No surface carries it twice.

## States

No new state is introduced. The polish pass refines existing states rather than creating new ones.

## Copy and microcopy

All polish copy is already in the approved anchors from prior stories; the one canonical addition:

- Single-label Results breadcrumb button: `Back to Intake` (with `arrow_back` material icon prefix).
- Single-label Results breadcrumb privacy chip: `Nothing is stored` (truncated form of the full anchor, rendered as a small chip to avoid visual duplication with the bottom action bar's privacy line — which already carries the full sentence).

## Accessibility, privacy, performance

- **Keyboard.** `Back to Intake` is the first Tab stop on the Results view. `Cancel review` is an early Tab stop on the Processing view. Both are reachable without the reviewer touching a mouse.
- **Screen readers.** The new Back-to-Intake nav uses `aria-label="Back to intake"` on its button; the privacy chip has `aria-hidden="true"` because the full anchor is carried elsewhere.
- **Color independence.** Confirmed via audit; no remediation expected to be needed.
- **Reduced motion.** Confirmed via audit; fix any gap surfaced.
- **Privacy.** No behavior change. No new logging. No new state surfaces. The new Back-to-Intake affordance reuses the existing `onNewReview` handler — which already revokes the image preview URL and clears intake state.
- **Performance.** No perceptible change. The polish adds at most a single nav bar per view; first-paint budgets are unchanged.

## Data and evidence needs from backend

None. This is a UI polish story.

## Frozen design constraints for Codex (`TTB-401`)

1. **No redesign of any approved surface.** Polish is additive.
2. **The new Back-to-Intake affordance on single-label Results is additive.** `Results.tsx` is not edited. `App.tsx` renders the nav bar above the `Results` call site.
3. **The breadcrumb pattern is shared across the product.** `TTB-104` drill-in shell and `TTB-105` single-label Results both use the same structural pattern (edge-to-edge nav, bordered button with hover promote, position/privacy chip at the far edge).
4. **Copy additions are minimal and canonical.** `Back to Intake` + `Nothing is stored` chip. No marketing copy.

## Open questions (captured for Codex handoff)

1. **Esc / keyboard shortcuts.** Polish reuses `Esc` for "go back" in both Results and Processing. This overlaps with the existing `Esc` behavior in `Results.tsx` (which collapses an expanded row if one is open). Ordering: if a row is expanded, `Esc` collapses it; if no row is expanded, `Esc` goes back. Acceptable? Default: yes; simple and matches the existing single-label shortcut posture.
2. **Back-to-Intake chip content.** The short `Nothing is stored` chip at the right of the breadcrumb is additive. If Codex thinks it clutters, we can drop it; the full privacy line is already carried in the Results action bar.
3. **Cancel-review promotion.** Moving the Processing Cancel from a footer link into a button-weight affordance in the same sidebar column. No visual-direction concern; flagged here for Codex visibility only.

## Out of scope for this spec

- Server-side privacy / latency / eval / submission — `TTB-401`.
- Guided review / help layer — `TTB-106`.
- Changes to the `TTB-102` evidence model or action-bar copy — both remain frozen.
