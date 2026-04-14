# UI Component Spec — TTB-106

## Story

- Story ID: `TTB-106`
- Title: guided tour, replayable help, and contextual info layer
- Parent: `TTB-004`
- Lane: Claude (UI) — engineering lands the typed manifest + stateless routes + demo fixtures afterward

## Problem

The integrated product is legible for an experienced TTB reviewer and completely learnable for a newer one — but between "legible" and "self-evident" sits a real cost in first-use friction. A character-aligned government-warning diff is expected in this domain; a confidence meter with amber/red thresholds is not. Batch matching ("we try filename first, then row order") is clear once explained; reviewers should not have to guess. And the "nothing is stored" guarantee is a hard compliance commitment that deserves a short plain-language explanation rather than a single sidebar line.

This story adds one optional guided tour flow that walks through the real product with safe seed data, plus a contextual info layer that surfaces plain-language explanations next to five dense concepts. Help is strictly opt-in, never a kiosk.

## Users and use cases

- **Primary: newer TTB reviewer.** Knows the domain, hasn't used this tool. Will take the tour once, may re-open info popovers later. Must feel respected, not patronized.
- **Primary: experienced TTB reviewer.** Skips the tour but appreciates info popovers near unusual surfaces (confidence meter, standalone mode). Must never be forced into help.
- **Secondary: supervisor / procurement viewer.** Watches the demo once, expects the tour to make the product make sense in 2–3 minutes. Needs the tour's pacing to respect their time.
- **Secondary: engineering / QA viewer.** Uses the tour to confirm privacy and no-persistence framing. Needs the info layer to explain the guarantees without marketing softness.

Use cases covered:

1. Launch the tour from anywhere in the app. Walk it at reviewer's own pace. Close without regret.
2. Open a contextual info popover next to warning sub-checks, confidence meters, standalone banner, matching explanation, or the privacy anchor.
3. See a one-time, dismissible first-run nudge pointing at the launcher. Dismiss or take the tour; either clears the nudge permanently.
4. Relaunch the tour later from the same launcher. No second nudge on subsequent sessions (versioned).
5. Keyboard users reach every help affordance; no hover-only patterns for critical content.

## UX flows

### Flow 1 — First-run nudge → tour (happy path)

1. Reviewer lands on intake with no prior session. A subtle, dismissible nudge appears anchored to the launcher button: `New here? Take a 2-minute tour.`
2. Reviewer clicks the launcher (either via the nudge or directly).
3. Nudge disappears permanently (versioned replay-state). Guided tour side panel slides in from the right edge.
4. Step 1 reads the app title region: "This is the single-label review flow — the workstation for one label at a time. Nothing you upload is stored."
5. Reviewer clicks `Next`. Step 2 drives a `Show me` that loads the `perfect-spirit-label` seed scenario into intake. Panel explains the form fields briefly.
6. Reviewer clicks `Next` through the tour: processing → results → warning evidence (highlights the sub-check list + diff region) → standalone mode (switches to standalone seed) → batch intake → batch dashboard → drill-in.
7. On the final step the panel ends with `You're done. Close this, or restart the tour from the launcher any time.`
8. Reviewer clicks `Close`. Panel slides out. Work resumes exactly where they left off.

### Flow 2 — Skip the tour, use the info layer

1. Reviewer dismisses the first-run nudge. Launcher remains visible.
2. Reviewer works through a label, reaches Results with a warning failure.
3. Next to the warning sub-check header, a small `info` icon is visible. Reviewer clicks it.
4. A popover opens in place with a title (`Warning evidence`) and 2–3 sentences: "We check the government warning in five ways — presence, exact text, uppercase heading, continuous paragraph, and legibility. The text comparison below highlights the exact words, letters, or punctuation that do not match the required wording."
5. Reviewer reads and presses Escape or clicks outside. Popover closes. No state change.

### Flow 3 — Keyboard-only

1. Reviewer tabs through the app shell; launcher is an early Tab stop.
2. Reviewer activates launcher with Enter. Panel opens; focus moves to the panel heading.
3. Reviewer uses Tab / Shift+Tab inside the panel to reach `Next` / `Previous` / `Close`. Arrow keys on the step indicator also advance steps.
4. Reviewer hits Escape. Panel closes; focus returns to the launcher.
5. For info anchors: Tab reaches the anchor button, Enter opens the popover, Escape closes it.

### Flow 4 — Relaunch

1. Reviewer finished the tour previously (localStorage marks `ttb-help:tour-completed:v1` as true).
2. On next session, no nudge appears.
3. Reviewer clicks the launcher at any time; tour starts from step 1 (tours are short — no mid-tour resume needed).

## IA and layout

### Launcher

- Location: app-shell header, right cluster, immediately before the scenario picker / Batch seed controls.
- Visual: a small bordered button with a `school` or `tour` icon + `Guided tour` label, matching the existing `TTB-105` back-button pattern at rest.
- Visible from every view (intake, processing, results, batch intake, batch processing, dashboard, drill-in).
- First-run nudge attaches to the launcher as a small floating chip with a downward-pointing tail. It dismisses on click, on the tour starting, or on the reviewer interacting with any other shell control.

### Guided tour side panel

Desktop (≥`md`):

```
App shell header (unchanged)
───────────────────────────────────────────────────────────────────
| Main work area                          | Guided tour panel    |
| (intake / processing / results /        | ┌────────────────────┐ |
|  batch / dashboard / drill-in)          | │ × Close            │ |
|                                         | │ Step 3 of 8        │ |
|                                         | │                    │ |
|                                         | │ Warning evidence   │ |
|                                         | │                    │ |
|                                         | │ 2–3 sentence body  │ |
|                                         | │                    │ |
|                                         | │ [ Show me ]        │ |
|                                         | │                    │ |
|                                         | │ ←  Previous  Next → │ |
|                                         | └────────────────────┘ |
───────────────────────────────────────────────────────────────────
```

- Width: ~360px at desktop, collapses to a bottom sheet on narrow viewports (mobile is not a primary use case but the product should not break).
- Not a modal: backdrop does not dim the main area; panel sits on top of it with a subtle left-shadow so the reviewer can still see the work area.
- Focus trap: Tab cycles within the panel while open; Escape closes.
- Step indicator: `Step 3 of 8` plus a thin progress bar underneath.

### Info anchor (small) + info popover

- Anchor: a `info` icon button, ~20px square, with a hover / focus ring. Placed to the right of dense section headings (e.g., warning sub-check group, confidence meter column) or inline at the end of an explanatory sentence (e.g., matching explanation, privacy anchor).
- Popover: appears next to the anchor with a small arrow, ~320px wide. Title + 2–3 sentence body + `Close` button.
- Not a tooltip: opens on click/Enter, not hover. Hover may reveal a one-sentence label (`Learn about warning evidence`) as a supplemental hint only.

### Semantic anchor keys (Claude places, Codex fills)

Target anchors for this story:

1. `warning-evidence` — on the `government-warning` row's expanded sub-check header.
2. `confidence-indicator` — on the per-field confidence meter block inside `FieldEvidence`.
3. `standalone-mode` — on the `StandaloneBanner` copy.
4. `batch-matching-logic` — on the matching explanation line in `BatchUpload`.
5. `no-persistence` — on the `Nothing is stored. Inputs and results are discarded when you leave.` anchor in every surface.

Each anchor is placed as a data attribute on a sibling element, plus the `InfoAnchor` button itself, so Codex can traverse the DOM by `data-help-anchor="<key>"` to attach manifest content. Claude does not edit frozen `TTB-102` / `TTB-103` / `TTB-104` components; instead, the `InfoAnchor` is rendered at the call site as a sibling element that does not change the component's internal layout.

### Replay state

- Key: `ttb-help:replay-state`
- Value (JSON): `{ version: 1, firstRunNudgeDismissed: boolean, tourCompleted: boolean }`
- Version bump invalidates the state. Codex can bump `version` via a build-time constant when the tour content changes enough that re-nudging is warranted.
- No server round-trip. No reviewer identity. No analytics hook.

## States

### Launcher

- **Idle (nudge active)** — launcher renders normally; first-run nudge chip floats below it.
- **Idle (nudge dismissed)** — launcher renders normally; no chip.
- **Tour active** — launcher renders with a subtle active-state treatment (e.g., border highlight) so the reviewer knows the panel is open.

### Guided tour panel

- **Open, step 1 of 8** — `Previous` inert, `Next` prominent.
- **Open, mid-tour** — `Previous` and `Next` both prominent.
- **Open, last step** — `Previous` prominent, `Next` replaced by `Finish`.
- **Open, after Finish** — brief "You're done" confirmation then auto-close on next click, OR panel persists with a `Close` and `Restart tour` affordance.
- **Closed** — not rendered.

### Info popover

- **Closed** — anchor icon visible.
- **Opening / Open** — popover visible with focus moved to its close button.
- **Closing** — popover fades / slides out (respects `prefers-reduced-motion`).

### Info anchors — when content is missing

- If the manifest does not carry an entry for an anchor key (e.g., Codex hasn't landed content yet), the anchor renders disabled with tooltip `Help content is on the way.`

## Copy and microcopy

Canonical strings. Do not paraphrase.

- Launcher button: `Guided tour` (with `school` or `tour` material icon prefix — Stitch picks, but the label is fixed).
- First-run nudge: `New here? Take a 2-minute tour.` + `Dismiss`.
- Panel heading: `Guided tour`.
- Step indicator template: `Step {index} of {total}`.
- Step navigation: `Previous`, `Next`, `Finish` (last step only), `Close`, `Restart tour` (post-finish).
- `Show me` action (variable per step): `Show me` (default), `Load sample` (on steps that need to seed a scenario).
- Tour finish line: `You're done. Close this, or restart the tour from the launcher any time.`
- Info anchor label (screen readers): `Learn about {topic}`, e.g., `Learn about warning evidence`.
- Info popover close: `Close`.
- Missing-content fallback: `Help content is on the way.`

### Seed tour content (English, 8 steps)

Claude ships a local fixture for the tour until Codex lands the manifest route. Canonical entries:

1. `orientation`: `This is a TTB label verification workstation. It helps you check one label at a time — or many at once — against the applicant's data and the relevant regulations. Nothing you upload is stored.`
2. `intake-form`: `Start by uploading a label image and filling in the application data. The form adapts to the beverage type — wine-specific fields appear only when you select Wine.`
3. `processing`: `When you verify, the tool runs a deterministic pipeline: read the image, extract the fields, detect the beverage type, run checks, prepare evidence. You can cancel at any time.`
4. `verdict-and-checklist`: `The results page shows one verdict — Approve, Review, or Reject — backed by a field-by-field checklist. Every row is explainable and citable.`
5. `warning-evidence`: `The government warning is one of the fastest ways a label can be rejected. The tool checks it five ways. If something is wrong, this section highlights the exact wording, punctuation, or capitalization to review. Use Load failing label to open an example.`
6. `standalone-mode`: `If you upload only an image with no application data, the tool runs standalone mode — it still extracts and checks, but it skips comparison steps and flags the result as needing a human read.`
7. `batch-matching`: `For many labels at once, upload images and one CSV. The tool matches images to rows by filename first and row order second, and surfaces any ambiguity before the run starts.`
8. `no-persistence`: `Nothing you do in this tool is stored. Images, forms, results, and batch sessions all live only as long as your browser tab is open. Close the tab and everything is gone.`

### Seed info popover content (English, 5 anchors)

1. `warning-evidence`: title `Warning evidence`. `We check the government warning in five ways — presence, exact text, uppercase heading, continuous paragraph, and legibility. The text comparison below highlights the exact words, letters, or punctuation that do not match the required wording.`
2. `confidence-indicator`: title `Confidence`. `This bar shows how confident the extraction is for this field. Green means 90%+; amber means 70–89%; red means below 70%. Lower confidence is never a verdict — it's a signal to verify manually.`
3. `standalone-mode`: title `Standalone mode`. `You uploaded an image without application data, so the tool is extracting and checking what it can read. Comparison checks that need the application data are skipped. Use Run Full Comparison to return and provide that data.`
4. `batch-matching-logic`: title `How matching works`. `We try to match each image to a CSV row using the filename column first. If a row has no filename, we fall back to row order. Ambiguous matches and unmatched items appear below so you can fix them before starting.`
5. `no-persistence`: title `Nothing is stored`. `Everything in this tool lives only in your browser tab. No images, no application data, no results, no batch sessions are written to a database, logged to a file, or retained by the model provider. Close the tab and it's all gone.`

## Accessibility, privacy, performance

- **Keyboard.** Launcher is Tab-reachable from the app shell header. The panel traps focus while open and returns focus on close. Info anchors are Tab-reachable; popovers are Escape-dismissible. Arrow keys on the step indicator advance steps.
- **Screen readers.** Panel uses `role="complementary"` with `aria-label="Guided tour"`. Popovers use `role="dialog"` with `aria-modal="false"` (they're not blocking) and an `aria-labelledby` pointing at the title.
- **Color independence.** Step indicator uses text + progress fill, not color-only. Info icons use both the icon shape and a visible label on hover/focus.
- **Reduced motion.** Panel slide-in and popover fade respect `prefers-reduced-motion`; under reduced motion they snap instead of animating.
- **Privacy.** No network call on help interactions once Codex lands the manifest (manifest is cached per session). No analytics. No reviewer identity sent. Replay state lives in `localStorage` only.
- **Performance.** Panel + popovers are light; no perceptible effect on first paint. Manifest is small (the 8 tour steps + 5 anchors above).

## Data and evidence needs from backend

Captured here for Codex; Claude does not edit shared contracts.

### Typed help contract

```ts
// src/shared/contracts/help.ts (to be added by Codex)
export const helpAnchorKeySchema = z.enum([
  'orientation',
  'intake-form',
  'processing',
  'verdict-and-checklist',
  'warning-evidence',
  'standalone-mode',
  'batch-matching-logic',  // tour step uses 'batch-matching' but info anchor key is this; keep both separate
  'batch-matching',
  'no-persistence',
  'confidence-indicator'
]);

export const helpEntrySchema = z.object({
  anchorKey: helpAnchorKeySchema,
  kind: z.enum(['tour-step', 'info-popover']),
  title: z.string(),
  body: z.string(),
  stepIndex: z.number().int().positive().optional(),      // tour-step only
  totalSteps: z.number().int().positive().optional(),     // tour-step only
  showMe: z
    .object({
      action: z.enum([
        'load-scenario',
        'advance-view',
        'open-panel-section'
      ]),
      payload: z.record(z.string(), z.string()).optional()
    })
    .optional()
});

export const helpManifestSchema = z.object({
  version: z.number().int().positive(),
  locale: z.string(),
  tourSteps: z.array(helpEntrySchema).min(1),
  infoPopovers: z.array(helpEntrySchema).min(1)
});
```

### API

- `GET /api/help/manifest?locale=en` → `helpManifestSchema`. Stateless. Cache-friendly (`Cache-Control: public, max-age=300`). No side effects.
- Optional future: `GET /api/help/recommend?view=batch-dashboard` returning a sensible first popover to surface on a given view. Not required for this story.

### Replay state boundary

- Client-local only. No route required. Codex can add an optional `POST /api/help/telemetry` later if the product ever needs it — out of scope here.

## Frozen design constraints for Codex

1. **Launcher is persistent in the header.** Do not move it into a floating action button, a keyboard-shortcut-only affordance, or a buried menu.
2. **Panel is a side panel, not a modal.** Does not dim the main work area.
3. **Panel width ~360px at desktop.** Adjust on narrow viewports; do not expand it to cover the primary content.
4. **Info popovers are click/Enter-opened, not hover-opened.** Hover may reveal a supplemental one-sentence label only.
5. **No persistence beyond `localStorage`.** No server-side progress tracking, no accounts, no analytics.
6. **Copy stays calm and procedural.** No celebratory "Great job!", no marketing tone.
7. **Manifest content is deterministic.** No AI-generated tutorial text at runtime.
8. **Semantic anchor keys are the contract.** UI renders anchors; manifest supplies content.
9. **Privacy anchor info popover reinforces the guarantee.** It does not water it down.

## Open questions (captured for Codex handoff)

1. **Tour content source of truth.** Claude seeds English content in `src/client/helpManifest.ts`. Once Codex adds the server route, the UI fetches from there. Should the client fixture stay as a fallback for offline dev, or be removed post-cutover? Default: keep as a fallback behind an env flag.
2. **Popover content mismatch handling.** If the manifest's `body` is longer than expected (e.g., a future localization expands), should the popover scroll internally or wrap taller? Default: wrap taller; popovers have a max width but no strict max height.
3. **`Show me` action scope.** For the POC, `Show me` covers `load-scenario` (e.g., load `perfect-spirit-label`) and `advance-view` (e.g., switch to batch mode). Cross-boundary actions (e.g., "simulate a batch run") are out of scope unless Codex wants to seed them later.
4. **Keyboard shortcut.** Should `?` or `/` open the guided tour panel? UI does not wire a shortcut in this story to avoid conflicting with browser find. Default: no shortcut for now.
5. **Per-role help.** Supervisors vs. reviewers vs. engineering viewers might want different framings. Out of scope. The manifest contract accommodates it later via a `role` field.

## Out of scope for this spec

- AI-generated help content.
- Account-backed onboarding state.
- Primary-surface layout changes.
- Localization beyond English.
- The release gate (`TTB-401`).
