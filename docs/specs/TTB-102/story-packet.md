# Story Packet

## Metadata

- Story ID: `TTB-102`
- Title: single-label results, warning evidence, and standalone UI
- Parent: `TTB-001`
- Lanes in scope: Claude (UI) + Codex (engineering behind the UI lands across `TTB-201` → `TTB-204` → `TTB-205`)
- Lane status: Claude `done` (UI approved 2026-04-13); Codex `done` after the live-results integration and standalone seed wiring completed on 2026-04-13
- Packet mode: expanded planning packet (reconciled at the expand gate and again at the handoff gate on 2026-04-13)

## Reconciliation notes

Reconciled 2026-04-13 twice per `docs/process/UI_CLAUDE_CHECKLIST.md`:

**Expand gate** — against `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `docs/backlog/codex-handoffs/TTB-101.md`:

- Constitution check rewritten lane-scoped (was story-scoped "UI only").
- Metadata now names both lanes and their current status, matching the SSOT queue.
- Task breakdown expanded to show the Claude flow end-to-end; Codex engineering for the behaviors this UI demands is tracked separately under `TTB-201` → `TTB-204` → `TTB-205` and is not duplicated here.
- Working-artifacts list points at the expanded docs.
- No contradiction found with the `TTB-101` handoff; `TTB-102` extends its frozen shell (title bar, Single/Batch toggle, pinned image column, theme tokens) without reopening it.

**Handoff gate** — against the approved UI slice and `docs/backlog/codex-handoffs/TTB-102.md`:

- Claude-lane status flipped `in-progress` → `done`.
- At handoff time, Codex-lane status flipped `blocked-by-dependency` → executable approved handoff: `ready-for-codex` in the backlog doc and `ready-parallel` in the live tracker. That handoff is now completed in the Codex lane.
- Working-artifacts list updated to point at the final docs: `ui-component-spec.md`, `stitch-screen-brief.md` (with §8 deviations recorded), `stitch-refs/` (6 HTML artifacts), and the Codex handoff.
- 2026-04-13 Codex completion pass: the client now renders the `/api/review` payload directly, standalone seed shaping is server-backed, and fixture controls are explicitly gated. SSOT now records `TTB-102` as `done`.

## Constitution check

### Claude lane (UI)

- Edits limited to `src/client/**` and `docs/specs/TTB-102/**` (plus the paired `docs/backlog/codex-handoffs/TTB-102.md` at handoff time).
- Do not edit `src/server/**`, `src/shared/**`, backend tests, or infrastructure.
- Preserve the `TTB-101` frozen shell verbatim: title bar, Single/Batch toggle, pinned image column, theme tokens, no raw hex in `src/client/**`.
- Preserve the checklist-first results hierarchy: recommendation banner → counts → ordered field rows → expandable evidence → cross-field checks → image reference → action bar.
- The government warning row is the densest surface; its expanded detail must stay readable when long text and the character-level diff appear.
- Standalone mode must be unmistakably distinct from comparison mode without a second route or a second page frame.
- Cover the six eval scenarios (`evals/labels/manifest.json`) as seeded result states.
- Honor the low-confidence, no-text-extracted, and recoverable-error states as first-class visual states, not afterthoughts.
- Respect `prefers-reduced-motion` and keep accessibility posture from `TTB-101` (icon + label + color, keyboard reach, 16px body minimum).
- Do not silently switch away from the project-default automated Stitch flow unless the pass is explicitly moved to `STITCH_FLOW_MODE=manual` or local Stitch auth is unavailable.
- Do not promise or perform deployment; deployment ownership sits with Codex and the Railway pipeline.

### Codex lane (engineering, behind this UI)

- Scope of the work this UI depends on lives in `TTB-201` (contract expansion), `TTB-204` (warning validator and diff evidence), and `TTB-205` (field comparison, cross-field checks, recommendation aggregation). The story-local `TTB-102` Codex integration is now complete; `TTB-205` remains the story that replaces the remaining seed-backed intelligence path with the real aggregation engine.
- Preserve the approved UI from this story when those engineering stories land. Do not redesign the results hierarchy, the warning detail surface, or the standalone-mode affordances.
- Return evidence payloads shaped to the contract notes in `ui-component-spec.md` §8; do not invent hidden backend behavior that the UI will then compensate for.
- Honor privacy invariants: `store: false`, no durable persistence, no logging of raw extracted text or application fields.
- Honor the sub-5-second end-to-end target; if streamed progress arrives, key events by the five canonical step IDs from `TTB-101`.

## Feature spec

### Problem

The reviewer experience only becomes persuasive when the results view communicates the recommendation, the evidence behind it, and the system's uncertainty in a single scan. The government warning is the densest surface in the product — reviewers must be able to see the system's verdict, the sub-checks it ran, the character-level diff against the canonical text, and the citations without leaving the page. The standalone path (no application data) must feel coherent, not like a degraded version of the comparison path.

### Acceptance criteria

- Results screen shows: recommendation banner, status counts, ordered field checklist, expandable per-field evidence panels, cross-field section, image reference, and action bar.
- Exactly one row is expanded at a time; expanding a new row auto-collapses the previous one.
- Government warning evidence includes: sub-check list, character-level diff between canonical text and extracted text, confidence indicator, and citations.
- Standalone mode is visually and copy-wise distinct from comparison mode and offers a path into full comparison.
- Low-confidence, no-text-extracted, and recoverable-error result states render coherently and never expose technical jargon.
- Each of the six eval scenarios renders a specific, named seeded result state accessible through the dev-only scenario picker.
- The two-column intake/processing frame (from `TTB-101`) remains the same frame when results render — no layout teleport.

## Technical plan

- Extend the existing state machine in `src/client/App.tsx` to add a `results` view after `terminal`, and a `standalone-results` variant when the reviewer submitted no application data.
- Build the results view as composition of small client components in `src/client/**`:
  - `Results.tsx` — layout, verdict banner, counts, field list, cross-field section, image column, action bar.
  - `VerdictBanner.tsx` — recommendation banner with icon + label + count summary.
  - `FieldRow.tsx` — collapsed row (field, application value, extracted value, status badge, chevron) and expanded panel.
  - `FieldEvidence.tsx` — expanded row body: summary, explanation, confidence bar, citations, diff for non-warning fields when applicable.
  - `WarningEvidence.tsx` — warning-specific expanded body: sub-check list + character diff + citations.
  - `CrossFieldChecks.tsx` — independent section below the field list.
  - `StandaloneBanner.tsx` — mode banner + `Run Full Comparison` action.
  - `ConfidenceMeter.tsx` — thin bar + numeric label with color thresholds per `MASTER_DESIGN`.
  - `StatusBadge.tsx` and `StatusIcon.tsx` — reused across rows, banner, and counts.
- Extend `src/client/scenarios.ts` with a seeded `VerificationReport`-shaped result payload for each of the six eval scenarios, plus a seventh `no-text-extracted` demo state and an eighth `low-confidence-global` state. Keep them read-only client-side mocks until Codex wires live data.
- Extend `src/client/types.ts` with UI-facing result view types (expanded row state, view enum).
- Plumb result mocks through the scaffold so the processing terminal state transitions into results instead of the dashed placeholder.
- No edits to `src/server/**`, `src/shared/**`, tests, or infrastructure. Record required backend fields and behaviors in `ui-component-spec.md` §8 and in the Codex handoff at approval time.

## Task breakdown

1. Expand the packet into the standard working UI docs (`ui-component-spec.md`, `stitch-screen-brief.md`). ← this pass
2. Stop for the Stitch prep handoff: paste `stitch-screen-brief.md` inline and ask the user to run Google Stitch in Comet and return a Stitch image reference plus Stitch HTML/code reference(s).
3. Save returned Stitch references under `docs/specs/TTB-102/stitch-refs/` and update §8 of the Stitch brief with actual paths and any deviations to normalize.
4. Implement the results surface in `src/client/**` against the returned references, using the seeded scenarios as mocks. Swap the dashed placeholder out for the live results view and add the standalone variant.
5. Cover every required state: each of the six eval scenarios, standalone mode, low-confidence global, no-text-extracted, cross-field checks present, long warning diff, and reduced-motion.
6. Run the dev server, open the app in Comet, and confirm `/api/health` returns `store: false`.
7. Stop for user visual review with a packaged handoff (scenarios to cycle through, specific states to inspect).
8. Incorporate feedback, get explicit approval, then write `docs/backlog/codex-handoffs/TTB-102.md` capturing frozen constraints, touched files, required backend payloads, privacy/latency constraints, and open questions.
9. Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md`: Claude lane `done`, next ready for Claude advances to `TTB-103`, Codex queue unblocks `TTB-201` once `TTB-102` handoff is `ready-for-codex`.
10. Reconcile this packet one more time at handoff: Claude-lane status → `done`, Codex-lane status → `ready-for-codex`, working-artifacts list points at the final docs.

## Working artifacts (final)

- `docs/specs/TTB-102/ui-component-spec.md` — UI design spec for results, warning evidence, and standalone mode.
- `docs/specs/TTB-102/stitch-screen-brief.md` — Stitch prompt + §8 with returned references, visual direction to preserve, and 25 deviations normalized during implementation.
- `docs/specs/TTB-102/stitch-refs/` — six returned Stitch HTML artifacts: `results-approve.html`, `results-review-cosmetic.html`, `results-reject-warning.html`, `results-reject-cross-field.html`, `results-standalone.html`, `results-no-text.html`.
- `docs/backlog/codex-handoffs/TTB-102.md` — completed engineering handoff and final frozen-UI contract.
- `src/client/Results.tsx`, `src/client/VerdictBanner.tsx`, `src/client/FieldRow.tsx`, `src/client/FieldEvidence.tsx`, `src/client/WarningEvidence.tsx`, `src/client/WarningDiff.tsx`, `src/client/CrossFieldChecks.tsx`, `src/client/StandaloneBanner.tsx`, `src/client/NoTextState.tsx`, `src/client/ConfidenceMeter.tsx`, `src/client/StatusBadge.tsx`, `src/client/ResultsPinnedColumn.tsx`, `src/client/resultScenarios.ts` — new UI components and seeded fixtures.
- `src/client/types.ts`, `src/client/App.tsx` — extended for result view state, `variantOverride` dev control, new handlers (`onNewReview`, `onRunFullComparison`, `onTryAnotherImage`, `onContinueWithCaution`, `onExportResults`). Preserves Codex's `POST /api/review` integration.
- `tailwind.config.js`, `docs/design/INDUSTRIAL_PRECISION_THEME.md` — added `caution` / `on-caution` / `caution-container` / `on-caution-container` tokens for the Review status palette; documented in the canonical theme table.

## Eval scenario coverage (seed target)

- `perfect-spirit-label` → `approve` banner, all rows pass, no cross-field issues.
- `spirit-warning-errors` → `reject` banner, warning row `fail` with expanded diff showing title-case and punctuation defects.
- `spirit-brand-case-mismatch` → `review` banner, brand row `review` with cosmetic-mismatch evidence and casing note.
- `wine-missing-appellation` → `reject` banner, appellation row `fail` plus cross-field check "Vintage requires appellation."
- `beer-forbidden-abv-format` → `reject` banner, ABV row `fail` with format explanation and citation.
- `low-quality-image` → `review` banner keyed by global low confidence; affected rows show amber/red confidence meters and a global advisory.
- Plus two UI-only demo states: `no-text-extracted` (no-text recoverable error) and `standalone-mode` (no application data) to exercise those flows.
