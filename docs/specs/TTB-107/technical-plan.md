# Technical Plan

## Modules

- `src/client/App.tsx` — root auth gate, signed-in shell handoff, and sign-out orchestration.
- `src/client/AuthScreen.tsx` — phase-specific Screen 0 rendering and timer-driven completion callbacks.
- `src/client/SignedInIdentity.tsx` — inline sign-out confirmation behavior.
- `src/client/authState.ts` — auth phase constants and any extracted transition/reset helpers.
- `src/client/useSingleReviewFlow.ts` — single-review reset semantics invoked on sign-out.
- `src/client/useBatchWorkflow.ts` and `src/client/useBatchDashboardFlow.ts` — batch/dashboard reset semantics invoked on sign-out.
- `src/client/useHelpTourState.ts` — guided-tour reset semantics invoked on sign-out.
- `src/client/auth-state.test.ts` — new regression tests for phase transitions, reset helpers, and no-persistence invariants.

## Approach

1. Expand the packet so the approved UI handoff becomes a concrete engineering contract.
2. Extract the auth transition and sign-out reset semantics into small testable helpers instead of leaving them fully inline in `App.tsx`.
3. Keep the UI markup and copy unchanged unless a tiny story-scoped refactor is needed to expose a stable test seam.
4. Derive tests from the handoff state machine and sign-out invariants:
   - phase advancement mapping
   - entry/back/confirm branches
   - root sign-out reset orchestration
   - no auth persistence writes
5. Stay inside the existing client-only architecture. Do not introduce a DOM testing framework unless the helper-level coverage proves insufficient.

## Test strategy

- Lowest viable layer:
  - pure/unit tests for auth phase advancement and sign-out reset orchestration
  - SSR/component-output tests for approved auth-screen states and signed-in identity rendering where static markup is enough
- Branch coverage targets:
  - initial entry
  - PIV loading/success path
  - SSO form/back/loading/success path
  - signed-in idle
  - sign-out confirm, cancel, and confirm-reset branches
- Boundary checks:
  - prove the sign-out handler invokes the single, batch, and help reset seams together with the root mode/view/auth resets
  - prove auth-specific persistence surfaces remain absent
- Manual verification:
  - keep the signed-in inline confirm `Cancel` and auto-dismiss branches on the manual QA script for this story because the current repo test surface is still pure/SSR rather than DOM-interaction driven
- Mutation/property testing:
  - not required unless the refactor introduces broader pure-logic branching beyond direct transition/reset helpers

## Risks

- The current repo has no jsdom-style interaction harness checked in, so the tests need to stay near pure helpers and server-render output unless a tooling expansion becomes unavoidable.
- The worktree already contains in-flight `TTB-106` changes; verification must avoid disturbing unrelated surfaces.
