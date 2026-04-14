# Privacy Checklist

## Story

- Story ID: `TTB-107`
- Title: mock Treasury auth entry and signed-in shell identity

## Data handling rules

- [x] No real credentials are collected or validated.
- [x] The SSO `User ID` input remains in component state only.
- [x] No auth state is sent to the server.
- [x] No auth state is written to `localStorage`, `sessionStorage`, or cookies.
- [x] A page reload drops back to Screen 0.
- [x] Sign-out clears app-local working state in the current tab.

## Story-specific checks

- Auth phase stays in React state under `App`.
- The only existing client persistence seam in this repo remains `ttb-help:replay-state`, which is unrelated to auth.
- This story adds no new request/response logging, temp files, uploads, or model calls.

## Verification

- Add regression tests for auth no-persistence invariants.
- Confirm manual sign-out from a non-default workstation state returns to Screen 0 without stale review data.
