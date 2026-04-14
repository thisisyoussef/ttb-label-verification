# Stitch Screen Brief — TTB-106

## Story

- Story ID: `TTB-106`
- Title: guided review, replayable help, and contextual info layer
- Parent: `TTB-004`
- Lane: Claude (UI)

## 1. Screen goal

Design two in-context compositions that extend the existing TTB label verification workstation with an optional, replayable guided review and a contextual info layer:

1. **Guided review, in context** — the workstation's existing single-label Results view is visible in the main work area, and a side panel docks to the right edge showing the active tour step (title + plain-language body + optional `Show me` action + Previous / Next / Close). The tour is not a modal; the main area stays usable behind it.
2. **Contextual info popover, in context** — the workstation's existing single-label Results view is visible, and a small info popover is open next to the government-warning sub-check header, showing a short explanation with a title, 2–3 sentences, and a Close affordance.

The tour and the info popovers are strictly opt-in. The workstation is not a kiosk; the tour is a drawer the reviewer opens at will.

## 2. Target user and moment

Primary: a TTB reviewer who has landed on this tool for the first time. They know the domain (labels, warnings, appellations, ABV formats) but don't yet know this specific workstation. They want to learn it in under 3 minutes without feeling patronized, and they want help available later when they hit something dense without being forced into a tutorial.

Secondary: an experienced reviewer who ignores the tour entirely but clicks a small info icon next to the warning sub-check panel the first time they see one, reads two sentences, and moves on. They must not be interrupted.

Secondary: a supervisor or procurement viewer watching a short demo. They expect the tour to explain the product's compliance and privacy posture inside 2–3 minutes.

## 3. Screen prompt for Stitch

> **Platform: web only. Generate web output only (web screens and web HTML/code), not mobile, iOS, Android, or tablet-app artifacts.** This is a desktop-first web application for a government compliance workstation; touch is not the primary input. The browser is typically 1280–1440px wide under fluorescent office lighting.
>
> Design two compositions that extend an existing web application. The existing workstation shell and the existing single-label results surface must be visible in both compositions — you are *not* designing a new product; you are designing two in-context additions to an existing one.
>
> **Composition 1 — Guided review, in context.**
> Render the existing workstation: the header (title, a `Single | Batch` toggle, a small header-resident `Guided review` launcher button), the pinned left column showing the submitted label image + filename + size + beverage type + a privacy line, and the main working area showing the approved Results view (verdict banner reading `Recommend approval` or `Recommend manual review`, a field checklist, and a cross-field checks region). On the right side, docked to the viewport edge, render a side panel ~360px wide showing the active tour step. The side panel must read as a drawer over the workstation — the work area behind it is still visible and usable, not dimmed by a modal backdrop. Each tour step has a compact header with a close button on the top-right, a step indicator reading `Step N of 8` with a thin progress bar underneath, a short plain-language title, a 2–3 sentence body, an optional `Show me` action, and `Previous` / `Next` (or `Finish` on the last step) controls at the bottom. The whole thing reads calm and instrument-like — not cheerful, not marketing, not game-like.
>
> **Composition 2 — Contextual info popover, in context.**
> Render the same existing workstation with the Results view showing a reject verdict where the government warning row is expanded. Next to the row's sub-check header (the `Warning sub-checks` list), render a small `info` icon button. Render an info popover opened from that anchor: a small floating card (~320px wide) with a small pointing tail, showing a title (`Warning evidence`), a 2–3 sentence body in plain language explaining what the five sub-checks mean and what the character-aligned diff below shows, and a `Close` affordance. The popover is not a modal; the work area is visible beneath it.
>
> Both compositions must preserve the approved design language of the workstation: the same header, the same Results layout, the same status vocabulary (Pass / Review / Fail / Info / Error), the same privacy anchor (`Nothing is stored. Inputs and results are discarded when you leave.`). Do not redesign any approved region. Do not introduce a user profile surface, a navigation sidebar, audit IDs on rows, celebratory copy, or analytics-dashboard flourishes.

## 4. Required functional regions

**Composition 1 — Guided review in context**

- The existing workstation frame (header + pinned left column + Results working area) visible on the left and center.
- A persistent `Guided review` launcher button in the header's right cluster (a bordered button with a small icon and the text label).
- A side panel docked to the right viewport edge, ~360px wide, with:
  - A close affordance at the top-right of the panel.
  - A panel title reading `Guided review`.
  - A step indicator reading `Step N of 8` plus a thin progress bar.
  - A step title (one short sentence).
  - A step body (2–3 sentences in plain language).
  - An optional `Show me` action below the body.
  - Previous and Next (or Finish) controls at the bottom of the panel.
- A subtle first-run nudge chip floating below the launcher pointing at it, with a short copy like `New here? Take a 2-minute tour.` and a `Dismiss` option. Render this chip in the composition to cover the first-run state.

**Composition 2 — Contextual info popover in context**

- The same workstation frame visible behind the popover.
- The Results view with the government-warning row expanded, showing the five sub-checks grouped as a list and a character-aligned diff below them. (Do not redesign these — render them in the same approved visual register.)
- A small `info` icon button positioned to the right of the sub-check group's header.
- An info popover opened from the anchor with:
  - A small pointing tail connecting the popover to the anchor.
  - A compact title (`Warning evidence`).
  - A 2–3 sentence body in plain language.
  - A `Close` affordance.

## 5. Required states and variations to render

Render these distinct states so the returned HTML covers them. If one HTML artifact can represent more than one state via minor variation, call the variations out explicitly.

**Composition 1 (Guided review):**

1. **First-run nudge visible, panel closed.** Launcher in the header, nudge chip floats below it pointing up, Results view is the visible main area. Reviewer has not opened the tour yet.
2. **Panel open, step 3 of 8 (mid-tour).** Launcher shows an active-state treatment. Side panel is open, mid-tour step rendered. Previous and Next both prominent. Nudge is gone.
3. **Panel open, step 8 of 8 (last step).** Same as mid-tour, but Next is replaced by Finish and the step body ends with the approved finish-line copy.

**Composition 2 (Info popover):**

4. **Popover open, anchored to the warning sub-check header.** Results view shows a reject verdict with the warning row expanded. Info icon visible next to the sub-check group header. Popover open with title, body, and Close.
5. **Popover closed, anchor visible.** Same composition, popover not rendered; the info icon sits at rest next to the sub-check header, subtle but discoverable.

## 6. Copy anchors

These strings are content, not design. Render them verbatim.

- Launcher button label: `Guided review`.
- First-run nudge body: `New here? Take a 2-minute tour.`
- Nudge dismiss action: `Dismiss`.
- Panel heading: `Guided review`.
- Step indicator template: `Step {index} of {total}` (e.g., `Step 3 of 8`).
- Step body for composition 1 state 2 (mid-tour on warning evidence): title `Warning evidence`, body `The government warning is the most rejection-critical element. The tool checks five sub-checks — presence, exact text, uppercase heading, continuous paragraph, legibility — and shows a character-aligned diff when anything is off.`
- Step body for composition 1 state 3 (last step): title `You're done.`, body `Close this, or restart the tour from the launcher any time.`
- Show me action: `Show me`.
- Step navigation labels: `Previous`, `Next`, `Finish` (last step only), `Close`.
- Info popover title (composition 2): `Warning evidence`.
- Info popover body: `We check the government warning against the required wording in five sub-checks — presence, exact text, uppercase heading, continuous paragraph, legibility. The character-aligned diff below shows where a failed text check differs from the required wording.`
- Info popover close: `Close`.
- Info anchor accessible name (screen reader): `Learn about warning evidence`.
- Privacy anchor (unchanged, visible in the workstation frame beneath both compositions): `Nothing is stored. Inputs and results are discarded when you leave.`
- Top identification region (unchanged): product title `TTB Label Verification Assistant`, tagline `AI-assisted compliance checking`, `Single | Batch` toggle.

## 7. Feelings and intents

Aim for:

- **Calm, instrument-like, opt-in.** Help is a drawer the reviewer opens — never a gate they have to clear. The whole product should read the same whether the tour is running or closed.
- **Respectful of expertise.** Experienced reviewers should feel unbothered by the help. Newer reviewers should feel quietly supported. Neither should feel patronized.
- **Plain language.** Every tour step and every info popover body must read at a reviewer's first glance without jargon-ese. Avoid "Intuitive. Powerful. Modern." register.
- **Privacy as a durable commitment, not a marketing point.** The info popover for `Nothing is stored` must reinforce the hard guarantee without softening it.
- **Instrument continuity.** The tour and popovers live in the same visual register as the rest of the workstation — bordered buttons, industrial-precision tokens, the same typography, the same privacy anchor.

Explicitly avoid:

- **Kiosk energy.** No full-screen modal backdrop on the tour. No "Let's begin!" splash. No forced first-run gate.
- **Game/onboarding energy.** No confetti on tour completion. No streaks, no checklists, no celebratory "Great job!". The tour just ends.
- **Marketing copy.** No "Welcome to the future of label review." No "Unlock powerful compliance." No "AI-powered" adjectives in tour or popover bodies.
- **Hover-only help for critical content.** Tooltips are fine for a one-sentence supplemental hint; anything that explains a concept opens on click.
- **Analytics-dashboard energy.** No tour "progress charts" beyond the simple step indicator. No trend lines. No score-at-end.
- **Over-designed info popovers.** They are small cards, not mini-documents. Title + 2–3 sentences + Close.
- **Mobile app patterns.** No bottom sheet on desktop. No swipe-to-dismiss. This is a web workstation.

## 8. Returned Stitch references

Claude will run the automated Stitch flow (`STITCH_FLOW_MODE=automated` is already configured for this workspace) and record the generated references here.

- Stitch image reference: _pending_
- Stitch HTML/code reference: _pending_
- Date returned: _pending_
- Notes on which returned asset covers which state from §5: _pending_
- Deviations Claude normalized during implementation (recorded 2026-04-14 before implementation, following the TTB-102 / TTB-103 / TTB-104 pattern):

  **Both compositions — Stitch reinvented the entire workstation frame:**

  1. Product renamed to `ComplianceEngine` — dropped; product is `TTB Label Verification Assistant`.
  2. Left sidebar navigation (`Dashboard / Inventory / Archive / Settings`) — dropped; the product has never had a sidebar.
  3. Second left sidebar (`Overview / Verification / Discrepancies / History / Reports` + `New Audit` button) — dropped.
  4. Header `notifications` + `account_circle` icons and a search input — dropped; no user identity surface, no notifications, no search.
  5. `Project Alpha / Gov-ID: TTB-992-X` project/permit identity block — dropped (privacy-adjacent).
  6. Invented `Raw Data Preview` with `processing_id: "TTB-992-X"` audit IDs — dropped.
  7. Privacy anchor rewritten to `Nothing is stored on the server. Analysis happens in volatile memory for privacy compliance.` — reverted to brief verbatim: `Nothing is stored. Inputs and results are discarded when you leave.`

  **Screen 1 — workstation-area reinventions dropped:**

  8. `Recommend approval` banner with `Confidence: 98.4%` inline chip — the real `VerdictBanner` from TTB-102 is rendered instead.
  9. Checklist rewritten with status words `MATCHED / 45% VOL / 750 ML` — reverted to the TTB-102 evidence model vocabulary (`Pass / Review / Fail / Info`) via the existing `FieldRow` component.
  10. Invented cross-field evidence text (`Validated: 'Straight Bourbon' matches classification.`, `Matched with COLA registry database record 882-X.`) — reverted to the real TTB-102 `CrossFieldChecks` output.
  11. "Bento" two-column card layout — dropped; the real single-column field-row list from TTB-102 is preserved.

  **Screen 2 — workstation-area reinventions dropped:**

  12. `Compliance Review: Batch #2024-08-A` + `Submission timestamp: 2024-05-22 14:32:01 EST` header — dropped.
  13. `Passed Checks 142 · Critical Failures 03 · Pending Manual Review 08 · Total Elements 153` stats grid — dropped (explicit §7 anti-pattern: analytics-dashboard energy).
  14. `27 CFR 16.21 / 16.22 / 16.33` citation column added to every row — dropped; citations live inside the TTB-102 expanded evidence panels, not as a top-level column.
  15. Status vocabulary `Consistent / Critical Failure / Valid` — reverted to brief's `Pass / Review / Fail / Info / Error`.
  16. `Discrepancies 14` sidebar badge — dropped with the sidebar.
  17. Invented `OCR Confidence Visual` with `Segment ID: TTB-992-X-WARN-01` — dropped (audit-trail-adjacent).

  **Screen 1 — guided review panel copy normalized:**

  18. Panel title `Guided Review` → brief verbatim `Guided review` (lowercase r).
  19. Step indicator template rendered `Tour Step 2 of 8` + a separate `25%` pct label — normalized to brief template `Step {n} of {total}` + progress bar without the percent text, which is redundant with the bar.
  20. Invented tour-step title `Verify Brand Name` + body about application data vs OCR extract — reverted to brief's approved step 5 content `Warning evidence` with the verbatim five-sub-check body.
  21. `Next Step` button label → brief verbatim `Next`.
  22. Last step should use `Finish`; Stitch did not render that variant — implemented per brief.

  **Screen 2 — info popover copy normalized:**

  23. Popover body rewritten to `These checks verify the specific text, formatting, and legibility required by Part 16 of the CFR. Use the diff below to inspect character-level discrepancies.` — reverted to brief verbatim: `We check the government warning against the required wording in five sub-checks — presence, exact text, uppercase heading, continuous paragraph, legibility. The character-aligned diff below shows where a failed text check differs from the required wording.`
  24. Popover close rendered as a small text-link `Close` at top-right — preserved but sized to match the rest of the shell's button register.

  **Both compositions — states missing or misrendered, implemented directly:**

  25. First-run nudge chip pointing at the launcher (§5.1) — not rendered by Stitch; implemented.
  26. Step 1 (nudge active) and Step 8 / Finish state (§5.1, §5.3) — not rendered; implemented.
  27. Active-state treatment on the launcher while the panel is open — not rendered; implemented as a border highlight.
  28. Info anchor at rest (no popover open) state (§5.5) — partially rendered; preserved the icon shape at the correct location.
  29. Five semantic anchor keys from the brief (`warning-evidence`, `confidence-indicator`, `standalone-mode`, `batch-matching-logic`, `no-persistence`) — only `warning-evidence` was referenced by Stitch; the other four are placed at the approved call sites during implementation.

  **What was salvaged from Stitch:**

  30. The right-docked ~360px side panel shape for guided review (Screen 1).
  31. The small card-with-pointing-tail pattern for the info popover (Screen 2).
  32. The placement of the info icon immediately after a dense section heading (Screen 2).

  Everything else in the returned HTML is disregarded. The approved TTB-101 / TTB-102 / TTB-103 / TTB-104 / TTB-105 surfaces are rendered unchanged beneath the new help layer.

### Automated run — 2026-04-14T00:20:07.237Z

- flow mode: `automated`
- user review required before implementation: `true`
- project: `TTB Label Verification System` (`3197911668966401642`)
- model: `GEMINI_3_1_PRO`
- device type: `DESKTOP`
- artifact folder: `docs/specs/TTB-106/stitch-refs/automated/2026-04-14T00-20-07-236Z`
- manifest: `docs/specs/TTB-106/stitch-refs/automated/2026-04-14T00-20-07-236Z/manifest.json`
- raw response: `docs/specs/TTB-106/stitch-refs/automated/2026-04-14T00-20-07-236Z/raw-response.json`

#### Generated screens

1. `Guided Review Composition`
   - screen id: `cc31765ca5db4bd5b49e4de66d76c68c`
   - local HTML copy: `docs/specs/TTB-106/stitch-refs/automated/2026-04-14T00-20-07-236Z/01-guided-review-composition.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzhiNjA1Y2VhYjdjMzRiYzk4NDhiMDQwMDYzMTA3N2E2EgsSBxCDmeS-iQEYAZIBIwoKcHJvamVjdF9pZBIVQhMzMTk3OTExNjY4OTY2NDAxNjQy&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0ug0lbf5MTP6jRz2nJ2YRmDh01LyOq9Xs2rAGSdI3h90aVfQbYS3zi7AffiWtBtQedQ2SYDwqqcC5QBE2Z7lH0XXtl_W76DnEQnrTbN9GmLBykGs67nYFFLDr-N6LyBiP5p0nTachWk8datwYYLk6w9qK-98Mpb_L-GgXlYnrzKkfmzJ-j7Fr5HVG0M1xc-Gt6yPdw7hCBcnLqv4hLIq3y34XVesSnTEQhEvt3g-1gcGdoQuJzdG-uVxSQ
2. `Contextual Info Composition`
   - screen id: `2436040b4b40429fa9b4e951ab808995`
   - local HTML copy: `docs/specs/TTB-106/stitch-refs/automated/2026-04-14T00-20-07-236Z/02-contextual-info-composition.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzE3OWQ3ZWI2MzE2ZTQ2YmZhMDA4NWQxNTA3YThkZmM1EgsSBxCDmeS-iQEYAZIBIwoKcHJvamVjdF9pZBIVQhMzMTk3OTExNjY4OTY2NDAxNjQy&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0uiVb31yNkWUE994bCe1pK8HCqQUrgXUXNx5qyxnbAHkJk5_NiJcHOsCeU1Z8eZ1QBSP-FCrCySM7lo9kPmX1b-KYV93ArYbc2ts0X39vhjZSUsiToLpXt1YbW7PHO3e5QzkF9OK3gfIBqb7xjGkCJVJY20esdFsucAhWh-5gC45vMWB-WK4dR0jegWqetoReNARVbePdgD8MNjIxZZDD1c_O-UAtoUfWW_Qp_wyzpqhwsrnp-UpTK7YhpM
