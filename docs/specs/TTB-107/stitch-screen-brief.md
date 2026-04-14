# Stitch Screen Brief — TTB-107

## Story

- Story ID: `TTB-107`
- Title: mock Treasury auth entry and signed-in shell identity
- Parent: `TTB-004`
- Lane: Claude (UI)

## 1. Screen goal

Design two in-context compositions that extend the existing TTB label verification workstation with a prototype-safe institutional entry gate and a signed-in shell identity treatment:

1. **Screen 0 — the mock Treasury auth entry.** A plain light-gray page with a government website banner at the top and a centered internal-login card in the middle. The card carries a text-only heading and subtitle, a short prototype disclaimer, and two simulated sign-in options: PIV / CAC card and Treasury SSO. The screen reads as a careful prototype of an institutional entry point, not as a production login portal.
2. **Signed-in shell header treatment.** The existing app shell header (product title + Single | Batch toggle + Guided review launcher + dev controls) is extended to carry a small identity block at the far right: `Sarah Chen · ALFD` plus a `Sign out` button. The identity is additive — nothing else in the header moves.

The two compositions are the bookends of the mock-auth experience. Between them sit the brief PIV and SSO "theater" states (short spinners + success lines) rendered inside the same centered card; those can be indicated as state variations rather than separate compositions.

## 2. Target user and moment

Primary: a TTB reviewer opening the prototype for the first time. The entry screen signals "Treasury internal tool" immediately. They should complete either sign-in path in under 5 seconds and never think about the gate again until they sign out. The identity block in the header is a quiet confirmation that they are signed in.

Primary: a supervisor or internal evaluator watching a demo. Screen 0 earns credibility in the first few seconds. The experience must read as prototype-safe — clearly simulated, not an attempt to impersonate a production Treasury login portal.

Secondary: an engineering or QA reviewer verifying no real auth infrastructure is claimed. The screen must plainly be a client-side state machine: no real PIV middleware, no real SSO, no cookies, no tokens, no server session.

## 3. Screen prompt for Stitch

> **Platform: web only. Generate web output only (web screens and web HTML/code), not mobile, iOS, Android, or tablet-app artifacts.** This is a desktop-first web application for a government compliance workstation; touch is not the primary input. The browser is typically 1280–1440px wide under fluorescent office lighting.
>
> Design two compositions that extend an existing single-page web application.
>
> **Composition 1 — Mock Treasury auth entry (Screen 0).**
> A plain, light-warm-gray background fills the full viewport. At the top, render a thin full-width government website banner with the standard line `An official website of the United States government` plus a small `Here's how you know` disclosure control on the right. Below that banner, center a single login card horizontally and vertically in the remaining viewport. The card is about 440 pixels wide with comfortable internal padding, a clean border, a subtle shadow, and the same surface tone used for the existing workstation's cards. Inside the card, top to bottom: a text-only heading reading `TTB Label Verification System`; a short subtitle reading `Alcohol Labeling and Formulation Division — Internal Use Only.`; a thin divider; two stacked primary sign-in actions — `Sign in with PIV / CAC Card` (with a small `badge` icon) and `Sign in with Treasury SSO` (with a small `key` icon); a small, visibly secondary prototype disclaimer reading `This is a prototype. It is not a production Treasury system.` The card must read as institutional and careful — calm type, no marketing register, no celebratory moment, no gradient hero. Do **not** include any real Treasury seal, TTB seal, USA.gov branding, or imagery that could be mistaken for a production federal login portal. The two sign-in buttons are the most obviously interactive elements on the screen.
>
> **Composition 2 — Signed-in shell header with identity.**
> Render the existing workstation header exactly as approved in prior stories: product title `TTB Label Verification Assistant` on the left with tagline `AI-assisted compliance checking` underneath; a `Single | Batch` toggle; the existing dev scenario picker / variant / force-failure / batch-seed controls in the right cluster; a bordered `Guided review` launcher button. Extend the right cluster with a small additive identity block at the far right: a short identity line reading `Sarah Chen · ALFD` and, next to it, a bordered `Sign out` button with a small `logout` icon prefix. The identity line is subtle (no avatar, no role badge, no colored pill) and the `Sign out` button matches the visual register of the existing header buttons (bordered at rest, primary-gradient on hover). Beneath this header, render the existing single-label results view so the composition reads as "signed in, working on a label" — not a redesign of the app, just the additive identity affordance in context.
>
> Both compositions must preserve the approved product: the workstation header pattern, the `Single | Batch` toggle, the industrial-precision theme tokens, the privacy anchor copy, and the existing header controls. Do **not** introduce a left sidebar, a user profile page, notifications, search, a "Compliance Hub / History / Standards" nav, or any audit IDs on rows. The entry screen is prototype theater; the signed-in shell is additive identity on top of the frozen workstation.

## 4. Required functional regions

**Composition 1 — Mock Treasury auth entry (Screen 0)**

- A full-width top banner carrying the `An official website of the United States government` line and a `Here's how you know` disclosure control on the right side of the banner.
- A centered login card on a light-warm-gray page background.
- Inside the card, in order: heading `TTB Label Verification System`; subtitle `Alcohol Labeling and Formulation Division — Internal Use Only.`; a thin divider; a stacked pair of primary sign-in buttons (PIV/CAC and Treasury SSO), each with a short leading icon; a small prototype disclaimer reading `This is a prototype. It is not a production Treasury system.`
- No left sidebar. No right sidebar. No top navigation. No footer navigation. The page is the banner + the card + the background.

**Composition 2 — Signed-in shell header with identity**

- The existing header, preserved: product title + tagline + `Single | Batch` toggle + dev controls + `Guided review` launcher.
- At the far right of the header's right cluster, an additive identity block containing: a short identity line reading `Sarah Chen · ALFD` and a bordered `Sign out` button immediately after it.
- The existing Results view rendered beneath the header so the signed-in identity reads in context.

## 5. Required states and variations to render

Render these distinct states so the returned HTML covers them. If one HTML artifact can represent more than one state via minor variation, call the variations out explicitly.

**Composition 1 (Screen 0):**

1. **Entry** — two primary sign-in buttons visible. Card is at rest.
2. **PIV in progress** — replace the two buttons with a small centered spinner + status text `Reading PIV card…`. Disclaimer line remains visible.
3. **PIV success** — replace the spinner with a filled check icon in `tertiary` color + status text `Certificate verified — Welcome, Sarah Chen.`
4. **SSO entry** — replace the two primary buttons with a small `← Back` link above, a labeled `User ID` text field, and a `Continue` primary button. Disclaimer line remains visible.
5. **SSO verifying** — same layout as PIV in-progress but with status text `Verifying Treasury SSO session…`.
6. **SSO success** — same layout as PIV success but with status text `Session verified — Welcome, Sarah Chen.`
7. **`Here's how you know` disclosure open** — the banner reveals a short two-line explanation body underneath the collapsed banner row.

**Composition 2 (Signed-in shell):**

8. **Signed in, idle** — the identity block + `Sign out` button sit at the far right of the header. The rest of the header and the Results view render normally.
9. **Sign out confirmation inline** — the `Sign out` button is replaced inline by a small confirmation cluster: short text `Sign out and clear this session?` plus `Cancel` and `Sign out` actions. Not a modal. Not a dropdown.

## 6. Copy anchors

These strings are content, not design. Render them verbatim.

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
- Sign out confirmation: `Sign out and clear this session?`
- Sign out confirmation actions: `Cancel`, `Sign out`.
- Top identification region (unchanged from existing shell): product title `TTB Label Verification Assistant`, tagline `AI-assisted compliance checking`, `Single | Batch` toggle.
- Privacy anchor (unchanged, visible inside the app): `Nothing is stored. Inputs and results are discarded when you leave.`

## 7. Feelings and intents

Aim for:

- **Institutional, calm, prototype-safe.** The entry screen should feel like a careful demo of an internal federal workstation's entry point — not an attempt to imitate a production Treasury login. A knowledgeable evaluator should look at it and think "this is clearly simulated, and that's a responsible choice."
- **Quiet confirmation.** The signed-in identity block in the header is a background trust cue. It does not ask for attention. It does not try to sell personalization.
- **Text over imagery.** Federal credibility here comes from restrained typography and careful copy, not from seals, emblems, or official imagery. Text-only is the rule.
- **Instrument continuity.** Both compositions live inside the same industrial-precision design language as the rest of the product. The entry card is a careful card in that same system; the signed-in identity block uses the same bordered-button register as the existing header controls.

Explicitly avoid:

- **Real government branding.** No real Treasury seal, no real TTB seal, no `USA.gov` branding, no `.gov` URL framing, no `login.gov` lockup, no "official" visual marks that could be confused for production federal imagery. This is prototype theater, not impersonation.
- **Production-login aesthetic.** No password field. No MFA picker. No "Remember me" checkbox. No "Forgot your password?" link. No captcha. No security-question prompt. These are real-auth affordances this feature deliberately does not simulate.
- **Marketing / consumer / startup energy.** No hero imagery. No gradient background. No "Welcome!" splash. No "Sign in to unlock" copy. No celebratory animation on success beyond a brief check-mark beat.
- **Heavy identity surface.** No avatar, no role badge, no dropdown menu under the identity block, no "My account" link. The signed-in block is one identity line + one `Sign out` button. Nothing else.
- **Modal dialog patterns.** The sign-out confirmation is inline in the header, not a modal. The SSO form is inline inside the same card, not a second screen.
- **Mobile app patterns.** No bottom tab bar, no floating action button, no swipe gestures. Desktop web, top-to-bottom, institutional.

## 8. Returned Stitch references

The workspace now defaults to `STITCH_FLOW_MODE=claude-direct`, so this Stitch section is optional. If this story explicitly switches to `STITCH_FLOW_MODE=automated` or `manual`, record the returned Stitch references here.

- Stitch image reference: _pending_
- Stitch HTML/code reference: _pending_
- Date returned: _pending_
- Notes on which returned asset covers which state from §5: _pending_
- Deviations Claude normalized during implementation (recorded 2026-04-14 before implementation, following the TTB-102 / TTB-103 / TTB-104 / TTB-106 pattern):

  **Screen 0 — institutional framing**

  1. Invented US flag graphic inside the government banner using raw hex (`#005288`, `#002664`) — dropped. Brief was explicit: text-only federal context; no seals, no flags, no imagery. Banner is text-only.
  2. Raw hex values in the flag element — dropped with the flag.
  3. Disclaimer copy extended to `This is a prototype. It is not a production Treasury system. Unauthorized access is prohibited and subject to monitoring.` — reverted to brief verbatim: `This is a prototype. It is not a production Treasury system.` (The extra sentence is production-login register; §7 explicitly bans that.)
  4. Invented `info` icon prefixing the disclaimer — dropped; keeps the disclaimer line text-only.
  5. Invented page footer with `Nothing is stored…` + `Privacy Policy` + `Terms of Service` links — dropped. Brief said Screen 0 is banner + card + background only. Privacy anchor appears inside the signed-in app, not on the pre-auth gate (no app data to disclaim yet).
  6. SSO button rendered as `surface-container-high` secondary while PIV is gradient primary — normalized so both options render at equal weight. The brief frames them as peer paths ("The two sign-in buttons are the most obviously interactive elements on the screen."), not a preferred + alternative.
  7. States 2–7 not rendered — Stitch only produced the Entry state. The six missing variations (PIV in-progress, PIV success, SSO entry, SSO verifying, SSO success, banner-disclosure-expanded) are built directly from the brief's §5 and §6 copy anchors.

  **Screen 2 — signed-in shell**

  8. Header nav rewritten with `Single Mode / Batch Mode / Developer Controls` links replacing the existing `Single | Batch` two-button toggle — dropped. The existing toggle is frozen across TTB-101/102/103/104/105/106.
  9. Invented `Auditor ID: 99201-X` under the identity line — dropped (privacy-adjacent; same rule as the audit IDs rejected in TTB-103/104).
  10. Invented `account_circle` avatar icon next to the identity — dropped. Brief explicitly said "No avatar."
  11. Invented Dashboard Summary Bar at the top of the main area (`Compliance Status 94.2%`, `Review Queue 12 Labels`, `Processed (24h) 1,402`, `System Latency 180ms`) — dropped. Analytics-dashboard invention; §7 anti-pattern.
  12. Entire Results region reinvented from scratch (invented `Verification Report: #9938210-C`, invented product `Chateau Montelena Reserve 2019`, invented `EXPECTED / FOUND` layout, invented OCR overlay markers on the label image, invented `Technical Metadata` block with source resolution / capture date / batch reference) — dropped. The real TTB-102 Results component is the frozen contract and renders unchanged beneath the signed-in header.
  13. Raw hex values throughout the header (`#546067`, `#f2f4f3`, `#2d3433`) — dropped; use theme tokens only.
  14. `max-w-[1440px]` on the main area — normalized to the established `max-w-[1400px]`.

  **Salvaged from Stitch:**

  15. Screen 0's centered card composition (width, padding, stacked buttons, disclaimer-at-bottom shape).
  16. The identity-block position in the signed-in header: far right of the right cluster, after the existing controls, with a thin divider separating the identity line + `Sign out` button from the other header controls.

### Automated run — 2026-04-14T15:42:34.535Z

- flow mode: `automated`
- user review required before implementation: `true`
- project: `TTB Label Verification System` (`3197911668966401642`)
- model: `GEMINI_3_1_PRO`
- device type: `DESKTOP`
- artifact folder: `docs/specs/TTB-107/stitch-refs/automated/2026-04-14T15-42-34-534Z`
- manifest: `docs/specs/TTB-107/stitch-refs/automated/2026-04-14T15-42-34-534Z/manifest.json`
- raw response: `docs/specs/TTB-107/stitch-refs/automated/2026-04-14T15-42-34-534Z/raw-response.json`

#### Generated screens

1. `Auth Entry (Screen 0)`
   - screen id: `fd1b3fd54c5c4dc9b726520ff8e6981b`
   - local HTML copy: `docs/specs/TTB-107/stitch-refs/automated/2026-04-14T15-42-34-534Z/01-auth-entry-screen-0.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sX2NlNThlMjdiYWE4MzRjYjc4MTY4YmEwNWFiZmM5ZGIyEgsSBxCDmeS-iQEYAZIBIwoKcHJvamVjdF9pZBIVQhMzMTk3OTExNjY4OTY2NDAxNjQy&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0ugCJwJ_q0SGL3-pFXA4oRU17z0d5PohpqG5oNNc9H7uACgZOwwhgHqBwaaESVR33gXak5UinCU94fhucLusBmEHnCTxeMWPUdFdxCiT2zRVwjD3aaK6LXR9ol2pMw7O-uh7a12b65h5k-HkpiWfZkUwxfZai-FRNTPYgPo1aDOc1quNVUKC3y2eU5JVFR1HJnKyMr8pfjWs5NmTd3G-_WdX54mfUGPj9Y8VVJAgdM9yiHMrZhdE-fyJGzM
2. `Signed-in Results View`
   - screen id: `954ab6272ee242af80dd9c20ec828325`
   - local HTML copy: `docs/specs/TTB-107/stitch-refs/automated/2026-04-14T15-42-34-534Z/02-signed-in-results-view.html`
   - HTML source URL: https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ7Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpaCiVodG1sXzdmNzU5NmM5Y2JiMjQzOTRiMDMyNDcxNzJiODc0YTJlEgsSBxCDmeS-iQEYAZIBIwoKcHJvamVjdF9pZBIVQhMzMTk3OTExNjY4OTY2NDAxNjQy&filename=&opi=96797242
   - screenshot URL: https://lh3.googleusercontent.com/aida/ADBb0ugBlUcbzdLaWdsDw7nhSQqp7jBvPnN8DvJ_aV2o61oS6phRGS1jPX6ZmCMJyQ-RikNj7se-TonuwDvdS83OzAxfU8iNEFYW-gggCH_nNNXbLFyC9evVLas86tplHZPBilYDgiZBWHmHJ-MSccwYL1GY3spghLHQUV29sLC8ZLWfTkjq457FwBOBnGbteNkbYzL8_hXmJJNIbXmMyAYdMbyePHLJyPYUeY7bLMSKhhCq5pWUoLsO_7V4D6U
