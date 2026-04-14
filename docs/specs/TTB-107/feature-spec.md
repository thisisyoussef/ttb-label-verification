# Feature Spec

## Story

- Story ID: `TTB-107`
- Title: mock Treasury auth entry and signed-in shell identity

## Problem statement

The approved UI for `TTB-107` already delivers the intended mock Treasury entry experience, but the Codex lane still needs to prove that the flow is stable and prototype-safe. Right now the auth behavior is mostly encoded inline in the root app component, and there is no regression suite covering:

- both sign-in paths across their loading and success states
- the back/cancel/sign-out branches
- the sign-out reset guarantees for existing single-label, batch, preview, and guided-tour state
- the no-persistence promise that keeps the auth shell clearly separate from real identity infrastructure

Without that coverage, future client work could quietly leave stale review data behind after sign-out or drift into persistence behavior that contradicts the product's privacy posture.

## User-facing outcomes

- The mock auth screen always behaves predictably for demos and local reviews.
- Reviewers can sign out from any in-app state and reliably return to a clean Screen 0.
- The prototype continues to signal institutional context without ever behaving like real credential handling.

## Acceptance criteria

1. The auth phase machine explicitly covers `signed-out`, both loading states, both success states, the SSO form branch, and the final `signed-in` state.
2. The PIV path transitions from entry to loading to success to signed-in without extra user input after the initial click.
3. The SSO path transitions from entry to form to loading to success to signed-in, and the Back action returns to entry without losing the typed user id.
4. The signed-in shell continues to show the approved identity block and inline sign-out confirmation behavior.
5. Confirming sign-out resets the active app session to the same clean state as a fresh load:
   - auth phase returns to `signed-out`
   - mode returns to `single`
   - view returns to `intake`
   - single-review state clears
   - batch dashboard and drill-in state clear
   - preview overlay closes
   - guided-tour session state resets
6. The auth surface performs no durable writes for auth state, credentials, or identity hints.
7. The story introduces no backend route, fetch call, cookie, or token surface.

## Out of scope

- real authentication or authorization
- protected routes or role-based UI
- persisted "remember me" behavior
- server-side identity logging or audit trails
- redesigning the approved Screen 0 or header identity block
