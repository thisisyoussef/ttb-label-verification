# UI Component Spec — TTB-107

## Story

- Story ID: `TTB-107`
- Title: mock Treasury auth entry and signed-in shell identity
- Parent: `TTB-004`
- Lane: Claude (UI) — client-side state wiring follows under Codex

## Problem

The product opens directly into the label workstation. That reads as an internal tool — but it misses the one-beat institutional cue that federal evaluators expect from real TTB / Treasury internal systems: a small, plain entry gate that signals "this is the workstation behind the Treasury authentication boundary." The feature is prototype theater: it is not real authentication, not real PIV smart-card IO, not real SSO. It exists to establish credibility in demos and user studies without accruing the cost, risk, or surface area of real auth infrastructure.

The risk to avoid is over-reach. A screen that carries real Treasury seals, or a flow that says "Authenticating against Treasury ICAM…" can read as impersonating a production service. The solution is a calm, text-only, institutional screen that reads as a careful prototype — obviously simulated, but plausibly sized for this environment.

## Users and use cases

- **Primary: Sarah Chen, ALFD reviewer (persona).** She opens the prototype and expects the product to feel internal. The Screen 0 card plus the signed-in `Sarah Chen · ALFD` identity in the header is the one-beat trust cue. She should walk through the mock auth in under 5 seconds and never think about it again until sign-out.
- **Primary: Marcus, supervisor reviewer (persona).** He watches a demo. The mock auth screen + signed-in shell signals "this person designed for our environment." It must read as prototype-safe, not impersonation.
- **Secondary: internal stakeholder / evaluator.** Wants to verify the product does not over-claim. Any detail that reads like it's pretending to be real auth (a real seal, real certificate language, a fake Treasury URL) costs trust.
- **Secondary: engineering / QA viewer.** Wants to verify no real auth infrastructure, no cookies, no tokens, no server state. The view must be plainly a client-side state machine.

Use cases covered:

1. First load → Screen 0 → PIV/CAC path → short success state → app.
2. First load → Screen 0 → Treasury SSO path → User ID field → short verification state → app.
3. Signed-in shell carries the identity in the top-right corner; reviewer ignores it while working.
4. Sign out → returns to Screen 0 → local app state cleared (image, form, batch session, reviewed-ids).
5. Subsequent first-load on the same tab after sign-out → Screen 0 again (no session persistence).

## UX flows

### Flow 1 — PIV/CAC path (happy path)

1. Tab loads. Screen 0 renders.
2. Government banner at the top reads `An official website of the United States government` with a `Here's how you know` disclosure.
3. Centered card: `TTB Label Verification System` heading, `Alcohol Labeling and Formulation Division — Internal Use Only.` subtitle, two primary actions — `Sign in with PIV / CAC Card` and `Sign in with Treasury SSO`.
4. Reviewer clicks `Sign in with PIV / CAC Card`.
5. Card transitions to a short progress state: a small spinner with `Reading PIV card…` This state lasts ~1.2 seconds under normal motion, instant under `prefers-reduced-motion`.
6. Card transitions to a success state: a small check icon with `Certificate verified — Welcome, Sarah Chen.` This state lasts ~0.7 seconds.
7. The screen fades out and the real app shell renders. The header now carries `Sarah Chen · ALFD` on the right plus a `Sign out` button.

### Flow 2 — Treasury SSO path (happy path)

1. Same Screen 0.
2. Reviewer clicks `Sign in with Treasury SSO`.
3. The card expands inline to reveal a `User ID` text field and a `Continue` button. The two entry buttons become a single `Back` link above the field.
4. Reviewer types anything (the behavior is identical regardless of input) and clicks `Continue`.
5. A short verification state: spinner + `Verifying Treasury SSO session…` (~1.2 seconds).
6. Success state: `Session verified — Welcome, Sarah Chen.` (~0.7 seconds).
7. Fade out → app shell with the same signed-in treatment.

### Flow 3 — Sign out

1. Reviewer is in the app. They click `Sign out` in the header.
2. A lightweight inline confirmation appears next to the button: `Sign out and clear this session?` with `Cancel` and `Sign out` actions.
3. On `Sign out`, the app state is cleared client-side (image preview URL revoked, form reset, batch session cleared, reviewed-ids Set emptied, any open drill-in closed, help panel closed).
4. Screen 0 renders. The reviewer can sign back in via either path.

### Flow 4 — Error / retry (intentionally minimal)

1. The mock paths cannot fail as a state — whatever the reviewer types or clicks, the flow continues. This is deliberate prototype theater.
2. However, for plausibility, the card's `Back` link during SSO returns to the entry state without losing the typed User ID (to avoid a frustrating re-type if the reviewer accidentally clicked `Back`).

### Flow 5 — Reduced motion / keyboard

1. Under `prefers-reduced-motion`, the progress / success state transitions snap immediately instead of animating the spinner pulse / fade.
2. Keyboard: `Tab` lands first on the `Sign in with PIV / CAC Card` button. Enter activates. During SSO entry, Tab cycles `User ID → Continue → Back`. `Esc` during SSO entry returns to the two-button entry state.

## IA and layout

### Screen 0

Full viewport composition:

```
┌─────────────────────────────────────────────────────────────────┐
│  An official website of the United States government  ▾ Here's │  ← top banner
│  how you know                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│                                                                 │
│               ┌───────────────────────────────┐                 │
│               │                               │                 │
│               │  TTB LABEL VERIFICATION       │                 │
│               │  SYSTEM                       │                 │
│               │                               │                 │
│               │  Alcohol Labeling and         │                 │
│               │  Formulation Division —       │                 │
│               │  Internal Use Only.           │                 │
│               │                               │                 │
│               │  ─────────────────────────    │                 │
│               │                               │                 │
│               │  [ Sign in with PIV / CAC  ] │                 │
│               │  [ Sign in with Treasury    ] │                 │
│               │  [   SSO                    ] │                 │
│               │                               │                 │
│               │  This is a prototype.         │  ← small note   │
│               │  Not a production system.     │                 │
│               │                               │                 │
│               └───────────────────────────────┘                 │
│                                                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Page background: `bg-background` (light warm gray), matching the app shell.
- Government banner: full-width thin bar at the top using `bg-surface-container-low` with `border-b border-outline-variant/20`. Disclosure chevron reveals a brief two-line explanation on click.
- Card: centered horizontally, ~440px wide, `bg-surface-container-lowest`, subtle `shadow-ambient`, `border border-outline-variant/20`. Vertical margins keep it clear of the banner and the footer edge.
- Prototype disclaimer at the card footer: small text, `text-on-surface-variant`, reads `This is a prototype. It is not a production Treasury system.`

### Card state — entry

- Heading + subtitle.
- Two primary buttons stacked vertically, equal width, matching the TTB-102 primary-gradient register (`bg-gradient-to-b from-primary to-primary-dim text-on-primary`).
- Buttons include short icon prefixes: `badge` (PIV/CAC) and `key` (Treasury SSO) material symbols.
- Prototype disclaimer at the bottom.

### Card state — PIV progress

- Replaces the two buttons with a small centered spinner + `Reading PIV card…` text.
- Disclaimer line stays visible.

### Card state — PIV success

- Replaces the spinner with a filled check icon in `tertiary` color + `Certificate verified — Welcome, Sarah Chen.`

### Card state — SSO entry

- Heading + subtitle unchanged.
- Replace the two primary buttons with: a small `← Back` text link above, a labeled `User ID` text field, a `Continue` primary button.
- Disclaimer line stays visible.

### Card state — SSO verifying

- Replaces the form with spinner + `Verifying Treasury SSO session…`

### Card state — SSO success

- Same layout as PIV success: filled check + `Session verified — Welcome, Sarah Chen.`

### Signed-in shell header

Existing app shell header gains a right-cluster identity group:

```
[ TTB Label Verification Assistant ]          [ … existing header controls … ]   [ Sarah Chen · ALFD ]  [ Sign out ]
```

- Identity text: `Sarah Chen · ALFD` in `font-label` with a subtle `text-on-surface-variant` tone. No avatar. No role badge (the `ALFD` suffix already signals the division).
- `Sign out` button: bordered button in the same register as the TTB-105 `Back to Intake` button — `bg-surface-container-lowest` + `border-outline-variant/30` + `shadow-ambient`, hover-promotes to the primary gradient. Small `logout` icon prefix.
- Confirmation: clicking `Sign out` replaces the button with an inline confirmation cluster (`Sign out and clear this session?` + `Cancel` + `Sign out`) for ~3 seconds or until the reviewer clicks one. Auto-dismisses to `Cancel` if ignored.

## States

### Screen 0

1. **Entry** — two primary buttons visible. First Tab stop is `Sign in with PIV / CAC Card`.
2. **PIV progress** — spinner + status line.
3. **PIV success** — check + welcome line. Auto-advances to the app after ~700ms.
4. **SSO entry** — form visible. First Tab stop is `User ID`. `Back` returns to Entry.
5. **SSO verifying** — spinner + status line.
6. **SSO success** — check + welcome line. Auto-advances to the app after ~700ms.
7. **Fading to app** — brief opacity fade (150ms) before the app shell mounts. Under `prefers-reduced-motion`, swap without the fade.

### Signed-in shell

8. **Signed in, idle** — identity + Sign out visible.
9. **Signing out, awaiting confirmation** — inline confirmation cluster shown in place of the Sign out button.
10. **Signed out, transitioning** — app state cleared, Screen 0 re-rendered.

## Copy and microcopy

Canonical strings. Do not paraphrase.

- Government banner line 1: `An official website of the United States government`.
- Government banner disclosure label: `Here's how you know`.
- Government banner disclosure body (when expanded): `This is a prototype. In a production Treasury system, this area would describe how to verify the site's authenticity.`
- Card heading: `TTB Label Verification System`.
- Card subtitle: `Alcohol Labeling and Formulation Division — Internal Use Only.`
- PIV button: `Sign in with PIV / CAC Card`.
- SSO button: `Sign in with Treasury SSO`.
- PIV progress: `Reading PIV card…`.
- PIV success: `Certificate verified — Welcome, Sarah Chen.`
- SSO back link: `← Back`.
- SSO field label: `User ID`.
- SSO submit button: `Continue`.
- SSO verifying: `Verifying Treasury SSO session…`.
- SSO success: `Session verified — Welcome, Sarah Chen.`
- Prototype disclaimer: `This is a prototype. It is not a production Treasury system.`
- Signed-in identity: `Sarah Chen · ALFD`.
- Sign out button: `Sign out`.
- Sign out confirmation: `Sign out and clear this session?`.
- Sign out confirmation actions: `Cancel`, `Sign out`.

## Accessibility, privacy, performance

- **Keyboard.** Screen 0 Tab order: government-banner disclosure button → PIV button → SSO button → prototype disclaimer (inert). SSO form Tab order: Back link → User ID field → Continue button. Signed-in shell: identity (inert) → Sign out. Escape during SSO entry returns to Entry.
- **Screen readers.** The card uses `role="main"` with `aria-labelledby` pointing at the heading. Status states (`PIV progress`, `SSO verifying`) use `role="status"` + `aria-live="polite"`. The success state briefly announces the welcome line.
- **Color independence.** Progress spinner uses a geometric animation plus a text line; success uses a check icon plus a text line. Neither relies on color alone.
- **Reduced motion.** Spinner pulses are class-only and snap under `prefers-reduced-motion`; fade transitions become instant.
- **Privacy.** No network request. No tokens. No cookies. No localStorage (the auth state is memory-only for the tab session). No analytics. The SSO form never sends the `User ID` anywhere — it is discarded on submit.
- **Performance.** Screen 0 first paint under 100 ms. The PIV + SSO timings are deliberately human-scale (~1.2s + ~0.7s) to read as institutional rather than instant; under reduced motion they compress to near-zero.

## Data and evidence needs from backend

None. The entire feature is client-local prototype theater. No shared contract change. No route. No persistence. Codex may add a client-local state machine with no server footprint.

## Frozen design constraints for Codex

1. **Prototype theater, not production.** No real auth, no real PIV, no real SSO, no tokens, no cookies, no server-side session state.
2. **Text-only federal context.** No real Treasury seal, no real TTB seal, no real `.gov` domains in the copy, no banner that could be mistaken for `USA.gov`.
3. **The two paths always succeed.** Whatever the reviewer types or clicks, they end up in the app. Introducing a failure state would require real auth semantics we explicitly do not want.
4. **Identity is fixed.** `Sarah Chen · ALFD` on every sign-in, regardless of which path or what the reviewer typed in the SSO field.
5. **Sign-out resets the tab.** Image preview URL revoked; form state cleared; batch session cleared; reviewed-ids cleared; help panel closed (when TTB-106 lands); any open drill-in closed; mode reset to `single`.
6. **Screen 0 is the first paint.** Until the mock auth completes, the app shell is not rendered.
7. **No persistence.** `localStorage` / `sessionStorage` / cookies are not written. The feature lives entirely in React state.
8. **Token-only styling.** No raw hex; continue the established token rules.
9. **Signed-in shell is additive.** The existing header layout is preserved; identity + Sign out are added to the right cluster, no other controls move.

## Open questions (captured for Codex handoff)

1. **Timing knobs.** The 1.2s + 0.7s durations are design choices, not brand rules. Codex may dial them up/down; if reduced motion, collapse to ~150ms each to keep the state transition observable but fast.
2. **Sign-out confirmation auto-dismiss.** The inline confirmation auto-dismisses to Cancel after ~3 seconds. If Codex thinks that's brittle, remove the auto-dismiss and let the reviewer click explicitly. Not a design blocker.
3. **SSO User ID preservation on Back.** UI default: preserve typed text when the reviewer clicks Back during SSO entry. Codex may clear it if a reset-is-cleaner argument emerges.
4. **`TTB-106` launcher placement.** The Guided review launcher (future) should sit in the signed-in shell's right cluster to the left of the identity block. Not implemented in this story; flagged here so TTB-106 can wire it in correctly.

## Out of scope for this spec

- Guided review / contextual info — `TTB-106`.
- Release gate (privacy audit, latency proof, eval run, submission packaging) — `TTB-401`.
- Any real auth infrastructure, identity provider integration, certificate parsing, or PIV middleware.
- Role-based feature access.
- Localization beyond English.
