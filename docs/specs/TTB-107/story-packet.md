# Story Packet

## Metadata

- Story ID: `TTB-107`
- Title: mock Treasury auth entry and signed-in shell identity
- Parent: `TTB-004`
- Lanes in scope: Claude (UI) + Codex (client-side state wiring and reset semantics)
- Lane status:
  - Claude lane: `done` — UI approved 2026-04-14; `docs/backlog/codex-handoffs/TTB-107.md` written as `ready-for-codex`
  - Codex lane: `ready-parallel` — regression tests + no-persistence invariant checks + timing-knob review, picked up when Codex has capacity
- Packet mode: expanded working packet
- Last reconciled: 2026-04-14 at the handoff gate, against `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `docs/backlog/codex-handoffs/TTB-107.md`

## Constitution check

### Claude lane (UI)

- UI only. Touch `src/client/**` and `docs/specs/TTB-107/**`. Never edit `src/server/**`, `src/shared/**`, validators, backend tests, or infra.
- This is prototype theater, not real security infrastructure. The screen may simulate PIV/CAC and Treasury SSO, but it must not imply that real authentication, smart-card IO, or certificate validation is happening.
- Use text-only federal context. Do not reproduce official Treasury or TTB seals, logos, or marks in a way that could be mistaken for a real government login portal.
- The signed-in identity must use the stakeholder-informed demo persona `Sarah Chen · ALFD`.
- The mock auth entry becomes Screen 0 and appears before any existing app surface. Once "authenticated," the user stays in the real app until they explicitly click `Sign out`.
- The rest of the approved app UI remains frozen. This story may wrap it in a new entry shell and title-bar identity, but may not redesign intake, results, batch, or drill-in layouts.
- Zero raw hex in `src/client/**`. Keep the established design-token rules.

### Codex lane (engineering)

- No real auth backend, no OAuth/OIDC flow, no credential validation, no smart-card integration, no session cookies, and no tokens.
- Keep the behavior client-local. A reviewer should always pass through after the mock interaction path completes.
- Sign-out must return to Screen 0 and clear app-local working state so uploads, forms, results, and batch session UI state do not survive the sign-out transition in the browser tab.
- Preserve the no-persistence product posture. Do not add server-side memory, storage, or logging for auth state.
- Preserve the approved UI without redesigning it. Edit `src/client/**` only to stitch the approved shell into working state transitions.

## Feature spec

### Problem

The product currently opens directly into the app. That is efficient, but it misses an important credibility cue for internal federal tooling: evaluators like Marcus and Sarah expect an internal system to begin from a recognizable institutional entry point. A lightweight mock auth screen lets the prototype signal "Treasury internal tool" immediately, without incurring the cost or risk of real authentication infrastructure.

The feature must feel authentic enough to show domain understanding, but it cannot overclaim. It should be obvious in implementation that this is a prototype-safe simulation, not a fake production login.

### Acceptance criteria

1. The first screen on app load is a mock internal entry screen on a plain light-gray background with a centered government-style login card.
2. A government website banner appears above the card with the standard "An official website of the United States government" framing and a `Here's how you know` disclosure treatment.
3. The login card includes text-only Treasury/TTB references, the heading `TTB Label Verification System`, and the subtitle `Alcohol Labeling and Formulation Division — Internal Use Only.`
4. The card presents two sign-in options:
   - `Sign in with PIV / CAC Card`
   - `Sign in with Treasury SSO`
5. Selecting the PIV/CAC path shows a short simulated progress state (`Reading PIV card...`) followed by a success state (`Certificate verified — Welcome, Sarah Chen`) and then transitions into the app.
6. Selecting the Treasury SSO path reveals a lightweight inline form with `User ID` and `Continue`; whatever the user types, the flow always continues through a short verification state and then into the app.
7. Once inside the app, the shell header shows `Sarah Chen · ALFD` in the top-right corner plus a `Sign out` action.
8. Clicking `Sign out` always returns the user to Screen 0 and clears local working state from the current tab session.
9. The mock auth experience does not add any real auth infrastructure, server route, token handling, or persistent account state.
10. The copy and visual treatment stay institutional, calm, and prototype-safe. No official seal art, no over-branded lockup, and no tone that suggests a real production login.

### Explicitly out of scope for `TTB-107`

- Real authentication or authorization.
- Treasury identity provider integration, PIV middleware, certificate parsing, or MFA.
- User roles, role-based feature access, or per-user data isolation.
- Any server-side auth state, audit trail, or login logging.
- Guided review and contextual help (`TTB-106`).
- Release-gate privacy/performance/eval packaging (`TTB-401`).

## Technical plan

- Expand this packet with Claude-owned UI planning docs (`ui-component-spec.md`, and `stitch-screen-brief.md` only if this story switches to a Stitch-assisted pass) before implementation.
- Treat the feature as a shell wrapper plus a small state machine, not as a backend feature.
- Claude designs:
  - Screen 0 government banner
  - centered internal-login card
  - PIV/CAC simulation states
  - Treasury SSO inline form states
  - signed-in shell header treatment with `Sarah Chen · ALFD` and `Sign out`
- Codex later wires:
  - client-local mock-auth state (`signed_out`, `piv_loading`, `sso_form`, `sso_loading`, `signed_in`)
  - timed transitions for the simulated auth theater
  - sign-out reset semantics for in-memory form/report/batch view state
  - regression tests proving either path always enters the app and sign-out always returns to Screen 0
- Keep the implementation free of server/API dependencies so the feature remains portable in demos and local builds.

## Task breakdown

### Claude lane

1. Reconcile this packet against the SSOT and persona doc (this planning revision).
2. Write `ui-component-spec.md` covering the entry screen, government banner, card structure, flow states, signed-in shell treatment, copy constraints, and prototype-safety constraints.
3. Default to a Claude-direct pass for the mock auth screen and signed-in shell header treatment; only use `stitch-screen-brief.md` plus Stitch if the story later switches to `STITCH_FLOW_MODE=automated` or `manual`.
4. Implement the mock auth entry and signed-in shell presentation in `src/client/**`.
5. Verify the screen feels institutional and calm without reading as a fake production portal; stop for visual review.
6. After approval, write `docs/backlog/codex-handoffs/TTB-107.md` and update SSOT.

### Codex lane (tracked here for scope clarity; executed after Claude approval)

1. Add the client-local mock-auth state machine and timed transition behavior.
2. Gate the existing app shell behind the mock auth entry.
3. Show `Sarah Chen · ALFD` plus `Sign out` in the title bar during the signed-in state.
4. Clear intake, result, and batch-local UI state on sign-out.
5. Add tests covering initial load, both auth paths, persistent shell identity, and sign-out reset behavior.

## Working artifacts

- `docs/specs/TTB-107/story-packet.md` — this file (expanded packet).
- `docs/specs/TTB-107/ui-component-spec.md` — to be created by Claude.
- `docs/specs/TTB-107/stitch-screen-brief.md` — optional, only if this story uses automated/manual Stitch.
- `docs/specs/TTB-107/stitch-refs/` — created only on Stitch return.
- `docs/backlog/codex-handoffs/TTB-107.md` — created after UI approval.
- Shared baseline: `docs/specs/TTB-105/story-packet.md`, `docs/specs/TTB-106/story-packet.md`, `docs/design/MASTER_DESIGN.md`, `docs/reference/product-docs/ttb-user-personas.md`, and the existing approved app shell in `src/client/**`.

## Reconciliation notes (2026-04-13)

- This story was added after the initial `TTB-106` planning pass. It stays queued as a follow-on UI story rather than changing the existing story order.
- The persona packet already identified the mock PIV/CAC screen as a useful trust signal for Marcus and the serious-demo posture expected by Sarah. This packet turns that discovery note into an executable story.
- The feature is intentionally simulated. The planning constraint is to demonstrate Treasury-environment awareness without crossing into fake-production branding or real auth complexity.
