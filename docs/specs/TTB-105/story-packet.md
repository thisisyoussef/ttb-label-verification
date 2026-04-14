# Story Packet

## Metadata

- Story ID: `TTB-105`
- Title: accessibility, trust copy, and final UI polish
- Parent: `TTB-004`
- Lanes in scope: Claude (UI polish) + Codex (final privacy / performance / eval / submission via `TTB-401`)
- Lane status:
  - Claude lane: `done` — UI polish approved 2026-04-13; `docs/backlog/codex-handoffs/TTB-105.md` written as `ready-for-codex`
  - Codex lane: `blocked-by-dependency` — `TTB-401` still gates on `TTB-106` complete per the SSOT queue; `TTB-105` being approved clears the polish prerequisite but not the `TTB-106` guided-review prerequisite
- Packet mode: expanded working packet
- Last reconciled: 2026-04-13 at the handoff gate, against `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/backlog/codex-handoffs/TTB-102.md`, `docs/backlog/codex-handoffs/TTB-103.md`, `docs/backlog/codex-handoffs/TTB-104.md`, and `docs/backlog/codex-handoffs/TTB-105.md`

## Constitution check

### Claude lane (UI polish)

- UI only. Touch `src/client/**` and `docs/specs/TTB-105/**`. Never edit `src/server/**`, `src/shared/**`, validators, backend tests, or infra.
- Must preserve the approved screen hierarchy and evidence language from `TTB-101` / `TTB-102` / `TTB-103` / `TTB-104`. This is a polish pass, not a redesign.
- Additive UI only inside frozen surfaces. E.g., do not edit `Results.tsx` action bar copy (frozen by `TTB-102` handoff §10) — add sibling affordances outside the component when new behavior is needed.
- Must satisfy the specific reviewer-feedback item raised during `TTB-104` approval: the single-label Results screen needs a clear, explicit Back-to-Intake affordance; `New Review` as the only exit is not discoverable.
- Must audit the integrated UI for color-only status, dense-state legibility, keyboard reachability, focus visibility, and trust-copy tone — fix gaps where found.
- Must not introduce new major surfaces that would require a Stitch pass; use established patterns (e.g., `TTB-104` drill-in breadcrumb bar) where additive affordances are needed.
- Zero raw hex in `src/client/**`. The `src/client/labelThumbnail.ts` SVG-content exception continues to apply.

### Codex lane (engineering, via `TTB-401`)

- Run the release gate once `TTB-105` is approved: privacy audit, end-to-end latency proof against the 5-second single-label budget, final eval run against the six canonical label scenarios, submission packaging.
- Preserve the polished UI without redesigning it.
- `TTB-401` does not start until `TTB-105` is `ready-for-codex`.

## Feature spec

### Problem

Now that the integrated product has every major surface in place (intake, processing, results, standalone, no-text, batch intake, batch processing, batch dashboard, drill-in), trust failures late in the flow come not from missing features but from small frictions: not finding the exit, not reading a status quickly enough, not trusting that the tool is not holding data beyond the session. The TTB-104 approval surfaced one such friction directly from the user: after a single-label review completes, the only way back to intake is to click the primary "New Review" button, which is not discoverable as "back." This story closes that friction and similar ones without redesigning any approved surface.

### Acceptance criteria (UI, Claude-owned)

1. After a single-label review completes, a clearly labeled Back-to-Intake affordance is visible above the Results component, in the same visual register as the `TTB-104` drill-in breadcrumb.
2. During single-label processing, the cancel affordance is discoverable without effort (not tucked into a footer text link).
3. Every compliance status (`Pass` / `Review` / `Fail` / `Info` / `Error`) is reinforced by an icon and a text label — never color alone — across every integrated surface.
4. Dense panels (warning sub-checks + character-aligned diff, batch triage table at 50 rows, cross-field checks with inline evidence) remain legible at practical zoom (100% at 1280–1440px browser width) without horizontal compression of status information.
5. Trust copy remains calm and procedural across every surface. No "Congratulations!", no "Oops!", no marketing register, no celebratory tone on all-pass terminals, no panic tone on all-fail terminals.
6. Every interactive element is reachable by keyboard; focus rings are visible via `:focus-visible`.
7. `prefers-reduced-motion` is honored on all entry / exit transitions and decorative animations introduced during earlier stories.
8. The privacy anchor (`Nothing is stored. Inputs and results are discarded when you leave.`) is visible on every main surface without repeating it into clutter.

### Explicitly out of scope for `TTB-105`

- Guided review, replayable help, contextual info layer — `TTB-106`.
- Release gate (privacy audit, latency proof, eval run, submission packaging) — `TTB-401`.
- Any new major surface or evidence model change — belongs in a new story with its own Stitch brief.

## Technical plan

- Do a targeted audit pass across `src/client/**` against the acceptance criteria above.
- Implement the `Back to Intake` affordance on single-label Results as an additive wrapper above the approved `Results` component, mirroring the `TTB-104` drill-in shell pattern (`w-full px-6 lg:px-8` edge-to-edge nav bar with a bordered button at viewport left). Do not edit `Results.tsx`.
- Promote the single-label Processing `Cancel review` from a footer text-link into a button-weight affordance consistent with the new pattern.
- Run a targeted accessibility + trust-copy audit; fix gaps inline where they are small and clearly within the "polish, not redesign" constraint.
- Do not run an automated Stitch pass for this story. The new polish affordances reuse the `TTB-104` drill-in breadcrumb pattern; no new visual direction is required.

## Task breakdown

### Claude lane

1. Reconcile this packet against the SSOT and previous handoffs (this revision).
2. Write `ui-component-spec.md` covering audit scope, specific polish items (Back-to-Intake affordance, Processing Cancel promotion, any gaps surfaced during the audit), frozen-constraint carryover, and open questions.
3. Implement the Back-to-Intake affordance and Processing Cancel promotion in `src/client/**`.
4. Run the audit for acceptance criteria 3–8; fix gaps inline.
5. Verify in Comet across single-label and batch flows; stop for visual review.
6. After approval, write `docs/backlog/codex-handoffs/TTB-105.md` and update SSOT.

### Codex lane (tracked here for scope clarity; executed under `TTB-401` when unblocked)

1. Privacy audit (no client logs, no server persistence, `store: false` everywhere).
2. End-to-end latency proof against the 5-second budget.
3. Final eval run against the six canonical label scenarios.
4. Submission packaging (repo hygiene, deployment verification, release notes).

## Working artifacts

- `docs/specs/TTB-105/story-packet.md` — this file (expanded packet).
- `docs/specs/TTB-105/ui-component-spec.md` — per-feature UI polish spec.
- `docs/backlog/codex-handoffs/TTB-105.md` — to be created after UI approval.
- Shared baseline: `docs/backlog/codex-handoffs/TTB-102.md`, `docs/backlog/codex-handoffs/TTB-103.md`, `docs/backlog/codex-handoffs/TTB-104.md`, `src/shared/contracts/review.ts`, `docs/design/MASTER_DESIGN.md`, `docs/design/INDUSTRIAL_PRECISION_THEME.md`, `evals/labels/manifest.json`.

## Reconciliation notes (2026-04-13)

- Original compact packet stated `UI-only polish story` as the full constitution check. Rewritten lane-scoped because `TTB-004` has an engineering sibling (`TTB-401`); both lanes are named here though Codex cannot start until this story is approved.
- Scope explicitly narrows to polish — the Back-to-Intake affordance is additive (outside the frozen `TTB-102` action bar), and no new Stitch pass is planned because the affordance reuses the `TTB-104` drill-in breadcrumb pattern.
- Acceptance criteria #1 directly encodes the user-reported friction from the `TTB-104` approval session.
