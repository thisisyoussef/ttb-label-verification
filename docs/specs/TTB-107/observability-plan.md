# Observability Plan

## Goal

`TTB-107` is a client-local state machine with simulated async transitions. The priority is to keep the behavior easy to debug without adding persistent logs or identity capture.

## Planned observability surface

- No new server logs.
- No auth telemetry, analytics, or durable browser storage.
- Test-visible helper seams for:
  - phase advancement decisions
  - sign-out reset orchestration
  - auth persistence invariants

## Branch markers to keep explicit

- `signed-out`
- `piv-loading`
- `piv-success`
- `sso-form`
- `sso-loading`
- `sso-success`
- `signed-in`
- sign-out confirm open
- sign-out confirm cancelled
- sign-out confirmed and reset

## Privacy guardrails

- Never log the typed `User ID`.
- Never emit auth state to server routes.
- Never write auth state to browser storage or cookies.

## Verification method

- Regression tests assert the branch transitions and the sign-out reset helper outputs directly.
- Regression tests assert auth files remain free of auth-specific persistence and network surfaces.
- Manual QA confirms disclosure toggle plus the signed-in inline confirm `Cancel` and auto-dismiss branches from a non-default in-app state.
