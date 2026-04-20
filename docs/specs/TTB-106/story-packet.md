# Story Packet

## Metadata

- Story ID: `TTB-106`
- Title: guided tour, replayable help, and contextual info layer
- Parent: `TTB-004`
- Lanes in scope: Claude (UI) + Codex (typed help contracts + manifest routes + demo fixtures)
- Lane status:
  - Claude lane: `done` — UI approved 2026-04-14; `docs/backlog/codex-handoffs/TTB-106.md` written as `ready-for-codex`
  - Codex lane: `done` — typed help contract, shared manifest fixture, stateless manifest route, and client cutover landed 2026-04-14
  - Note: the packet was earlier edited to claim this story was blocked by `TTB-107`. The user explicitly overrode that gate ("nah finish 106 first"); `TTB-106` landed first. `TTB-107` is now the next ready Claude story.
- Packet mode: expanded working packet
- Last reconciled: 2026-04-14 after Codex completion, against `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, the completed Codex integration in `TTB-205` + `TTB-301`, and `docs/backlog/codex-handoffs/TTB-106.md`

## Constitution check

### Claude lane (UI)

- UI only. Touch `src/client/**` and `docs/specs/TTB-106/**`. Never edit `src/server/**`, `src/shared/**`, validators, backend tests, or infra — Codex will add the typed help contract, manifest routes, and demo fixtures after this story's handoff.
- Help is optional, never forced. No kiosk-like blocking modals, no first-run gate the reviewer must clear before touching the app, no dismissible banner that re-appears on every load.
- Tooltip-only patterns are reserved for one-sentence supplemental hints. Critical explanations (what a warning sub-check means, why standalone mode exists, what no-persistence actually guarantees) open rich popovers or a side panel with keyboard-reachable content.
- Reuse approved surfaces without redesigning them. The guided tour runs *against* the existing UI using safe seed scenarios; it does not introduce a parallel product.
- Semantic anchor keys (e.g., `data-help-anchor="warning-evidence"`) are the contract between UI regions and backend help content. Claude places anchors; Codex fills manifest entries for them.
- Replay state is client-local (`localStorage`), versioned so a content refresh can invalidate it without involving the server.
- Zero raw hex in `src/client/**`. The `src/client/labelThumbnail.ts` SVG-content exception continues to apply.

### Codex lane (engineering)

- Add a typed tutorial/help contract under `src/shared/contracts/**` with semantic anchor keys + localized content structure.
- Add stateless `GET /api/help/manifest` and `GET /api/help/recommend` (or equivalent) routes serving deterministic content; no AI-generated tutorial text at runtime.
- Seed demo fixtures that drive the guided tour using the existing six eval scenarios, without introducing a second business-logic path.
- Preserve the approved UI without redesigning it. Edit `src/client/**` only to stitch the approved UI to live manifest content.
- No durable persistence of tutorial progress, uploads, or review results — session-scoped is the only allowed shape.

## Feature spec

### Problem

The integrated product now asks reviewers with very different technical comfort levels to navigate a dense, high-stakes workflow: upload → processing → results with character-aligned warning diffs and cross-field dependency checks, or batch intake → matching review → processing → dashboard → drill-in → export. For reviewers who have been doing label compliance for decades the tool is legible; for newer reviewers the evidence language is learnable but not self-evident. For demo viewers (supervisors, procurement) the product needs to explain itself in 2–3 minutes without bolting on a kiosk.

This story adds an optional, replayable guided tour plus a contextual info layer that explains the densest concepts in plain language — without turning the workstation into a tutorial-first experience.

### Acceptance criteria (UI, Claude-owned)

1. A persistent **Guided tour** launcher is visible in the app shell from every view. Clicking it starts the tour; closing it stops it without affecting work in progress.
2. The tour appears as a **side panel** that docks to the viewport right edge, not as a full-screen modal. The primary work area remains usable behind it.
3. The tour walks through the actual product using safe seed scenarios — intake → processing → results → batch → dashboard → drill-in — with one short step per stop.
4. Each tour step has a **plain-language title + 2–3 sentence body + optional "show me" action** that triggers a demo transition (e.g., loads a seed scenario, advances the view).
5. Reviewers can **exit** the tour at any step without losing in-flight work; closing and re-launching resumes cleanly from step 1 (tours are not long enough to require mid-tour resume).
6. A subtle **first-run nudge** appears once on first load pointing at the launcher; dismissing it or starting the tour clears the nudge permanently (client-local, versioned).
7. **Contextual info anchors** render as small `info` icon buttons next to the five named dense concepts: warning evidence, confidence indicator, standalone mode, batch matching logic, and the "nothing is stored" privacy line. Clicking opens a lightweight popover (not a modal) with a title + 2–3 sentence explanation.
8. Info popovers are **keyboard reachable**, Escape-dismissible, and do not rely on hover to open.
9. All help text is **deterministic and loaded from the typed manifest contract** once Codex lands it. Claude stubs the manifest shape + anchor keys in `src/client/**` so the UI works against a local fixture until the server route is live.
10. Copy across the tour and info layer stays calm, procedural, and plain-language — no "Welcome!", no "Congratulations!", no marketing register.

### Explicitly out of scope for `TTB-106`

- Persistent user accounts, per-user onboarding state, analytics-driven help surfacing.
- AI-generated tutorial text at runtime.
- New screens beyond the tour side panel and the info popover pattern.
- Translation / localization — the manifest contract should accommodate it later but this story ships English only.
- Changes to any approved evidence model, verdict banner, matching review, or dashboard layout.
- The `TTB-401` release gate.

## Technical plan

- Expand `docs/specs/TTB-106/ui-component-spec.md` with launcher placement, side-panel IA, tour step model, info popover pattern, semantic anchor keys, and replay-state versioning.
- Prepare `docs/specs/TTB-106/stitch-screen-brief.md` and run the automated Stitch flow (the workspace default) — two screens: guided tour side panel (with the app frame beside it so Stitch renders the "tour-in-context" composition) and a contextual info popover anchored to a dense element.
- Implement under `src/client/**`:
  - `HelpLauncher.tsx` — header-resident button.
  - `GuidedReviewPanel.tsx` — side panel with step flow, `Previous` / `Next` / `Close`, optional `Show me` affordance that calls back into app state.
  - `InfoAnchor.tsx` — small icon button rendered next to a dense element; opens `InfoPopover.tsx`.
  - `helpManifest.ts` — client-local stub manifest keyed by semantic anchor; to be replaced by a fetch against Codex's manifest route.
  - `helpReplayState.ts` — client-local `localStorage` versioned state for first-run nudge + tour-completed.
  - Wire anchors into the approved surfaces without editing frozen components (either pass an `info` slot where available or wrap with a minimal sibling element at the call site).
- Keep all help data client-side until Codex lands the manifest route; preserve the typed shape so the cutover is a simple fetch substitution.

## Task breakdown

### Claude lane

1. Reconcile this packet against the SSOT (this revision).
2. Write `ui-component-spec.md` (problem, users, flows, IA/layout, states, copy, anchors, replay state, open questions).
3. Write `stitch-screen-brief.md` and run automated Stitch; record returned refs in §8 and stop for user review.
4. Implement the help launcher + guided tour panel + info popover pattern + semantic anchor wiring in `src/client/**`.
5. Seed the five required info anchors and an 8-step tour covering the full product flow.
6. Verify in Comet across single-label and batch flows; stop for visual review.
7. After approval, write `docs/backlog/codex-handoffs/TTB-106.md` and update SSOT.

### Codex lane (tracked here for scope clarity; executed after Claude approval)

1. Typed help contract under `src/shared/contracts/**`. Done in `src/shared/contracts/help.ts`.
2. Stateless manifest route under `src/server/**`. Done as `GET /api/help/manifest`; recommendation routing remains intentionally out of scope for this story.
3. Deterministic content seeded for every semantic anchor Claude lands. Done in `src/shared/help-fixture.ts`.
4. Client fixture cut over to shared manifest runtime with offline fallback. Done in `src/client/helpManifest.ts` and `src/client/help-runtime.ts`.
5. Verify privacy, accessibility, and manual QA coverage. Done through contract, route, and runtime tests plus the final app handoff.

## Working artifacts

- `docs/specs/TTB-106/story-packet.md` — this file (expanded packet).
- `docs/specs/TTB-106/ui-component-spec.md` — per-feature UI spec.
- `docs/specs/TTB-106/stitch-screen-brief.md` — Stitch brief + returned-reference record.
- `docs/specs/TTB-106/stitch-refs/` — created on Stitch return.
- `docs/specs/TTB-106/user-flow-map.md` — explicit happy-path and branch map for the guided tour plus contextual help.
- `docs/specs/TTB-106/observability-plan.md` — sanitized observability fields, current debugging surfaces, and the local-only instrumentation gap.
- `docs/specs/TTB-106/tour-logic-branches.md` — branch-aware tour handling for non-happy-path runtime states.
- `docs/backlog/codex-handoffs/TTB-106.md` — created after UI approval.
- `src/shared/contracts/help.ts` — canonical help manifest and anchor schemas.
- `src/shared/help-fixture.ts` — deterministic English help manifest fixture.
- `src/client/help-runtime.ts` — route fetch + fallback bridge for the approved UI.
- Shared baseline: `docs/backlog/codex-handoffs/TTB-102.md`, `TTB-103.md`, `TTB-104.md`, `TTB-105.md`, `src/shared/contracts/review.ts`, `docs/design/MASTER_DESIGN.md`, `docs/design/INDUSTRIAL_PRECISION_THEME.md`, `evals/labels/manifest.json`.

## Codex completion notes (2026-04-14)

- Moved the canonical help schema into `src/shared/contracts/help.ts`, including semantic anchor keys, tour target keys, the `showMe` action model, and manifest validation.
- Moved the approved English help content verbatim into `src/shared/help-fixture.ts` so client and server read the same source of truth.
- Added `GET /api/help/manifest` in `src/server/index.ts` with `Cache-Control: public, max-age=300`; the route is deterministic and does not touch OpenAI, persistence, or logs.
- Replaced the client-only fixture binding with a small runtime bridge: `src/client/help-runtime.ts` fetches the remote manifest at startup, validates it, and falls back to the local fixture if the route is unavailable.
- Hardened the tour runtime so prerequisite gaps are explicit instead of silent: action steps now block `Next` until the required state is reached, the verify step still auto-recovers into deterministic sample results after a real failed run, and tour-loaded sample labels use a safe client-side demo image/report path rather than depending on live extraction.
- Wired the approved spotlight UI to that runtime: the app now resolves the live tour steps against the current shell state, passive steps advance normally, action steps block `Next` until the required state exists, and click-to-advance on the real Verify and Batch controls remains a direct interaction path.
- Tightened the Verify interaction path so the tour does not advance on the click event alone: Step 4 now waits through the click-to-processing transition, and if extraction fails during the tour it recovers into deterministic sample results before moving to the verdict step.
- Tightened the warning-evidence step so it no longer stops at the failing scenario alone: when Step 6 is active on the warning-defect results, the government-warning row auto-expands so the tour lands on the sub-checks and literal diff, not on a collapsed row.
- Added the retroactive `user-flow-map.md` and `observability-plan.md` artifacts for this guided-flow story so the current branch behavior and debugging surfaces are checked in, not chat-only.
- Finishing the tour now returns the shell to a clean signed-in single-label intake instead of leaving the user in the last demo state.
- Checked in the branch model behind that hardening in `docs/specs/TTB-106/tour-logic-branches.md` so each step's recovery behavior is explicit and reviewable.
- Removed the unused `src/client/GuidedReviewPanel.tsx` file from the rejected first-pass side-panel implementation so the approved spotlight flow is the only active help path.
- Verification added in `src/shared/contracts/help.test.ts`, `src/server/routes/help-routes.test.ts`, and `src/client/help-runtime.test.ts`.
- Additional tour-hardening verification added in `src/client/help-tour-runtime.test.ts`.
- Mutation testing waived for this story: the changed logic is schema validation plus route/runtime plumbing, not a high-risk pure validator or comparison helper where mutation score would add signal.

## Reconciliation notes (2026-04-13)

- Original compact packet named Claude-first, Codex-second as the primary lane. Rewritten lane-scoped: Claude owns the UI design + replay state placement, Codex owns typed contracts + stateless routes + demo fixtures; both are named here.
- Since the `TTB-105` handoff, Codex has landed `TTB-205` and `TTB-301` — the integrated single-label path (`POST /api/review`) and the live batch engine (preflight / run / retry / summary / report / export) now run end-to-end. The guided tour should walk through these real surfaces, not stubs.
- Scope explicitly excludes persistent user accounts, AI-generated tutorial text, and new primary surfaces. The story's shape is: a launcher + a side panel tour + an info popover pattern applied to five named dense concepts.
