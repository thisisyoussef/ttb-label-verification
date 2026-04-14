# Technical Plan

## Scope

Finish the Codex-owned runtime integration behind the approved `TTB-102` results UI without pulling `TTB-205` forward. The client should trust the `/api/review` response, the seed route should emit a real standalone report when intake fields are omitted, and dev-only fixture controls should stay explicitly gated.

## Modules and files

- Add `docs/specs/TTB-102/constitution-check.md`
- Add `docs/specs/TTB-102/feature-spec.md`
- Add `docs/specs/TTB-102/technical-plan.md`
- Add `docs/specs/TTB-102/task-breakdown.md`
- Add `docs/specs/TTB-102/privacy-checklist.md`
- Add `docs/specs/TTB-102/performance-budget.md`
- Add `src/client/review-runtime.ts`
- Add `src/client/review-runtime.test.ts`
- Update `src/client/App.tsx`
- Update `src/shared/contracts/review.ts`
- Update `src/shared/contracts/review.test.ts`
- Update `src/server/index.ts`
- Update `src/server/index.test.ts`
- Update tracker, workflow docs, handoff docs, and memory notes

## Contracts

- Keep the existing `verificationReportSchema` stable
- Extend `getSeedVerificationReport()` to support a standalone variant instead of mutating the client around a wrong payload
- Keep fixture-control logic client-local; it is a dev/runtime concern, not a shared contract

## Implementation notes

- Parse and return the `VerificationReport` from `submitReview()` so the client can render it directly
- Centralize result-selection logic in a small client helper so fixture-mode and live-mode behavior are testable
- Preserve seeded scenario behavior only when dev fixture controls are enabled and the operator selected a non-blank scenario
- Gate single-label and batch fixture selectors behind a Vite env-driven helper instead of leaving them permanently visible

## Risks and fallback

- Risk: the client could still drift into fixture mode unintentionally
  - Fallback: make fixture-mode selection explicit and test it as a pure helper
- Risk: standalone seed output could contradict the approved UI copy
  - Fallback: keep the standalone seed narrow and aligned to the contract examples already used in tests and handoff docs
- Risk: workflow reprioritization could hide later blocking work
  - Fallback: keep `TTB-205` visible as the next blocking non-`TTB-10x` Codex story in the tracker

## Testing strategy

- RED tests first for standalone seed output and the client result-resolution helper
- Route tests to prove `/api/review` returns a standalone report when application data is omitted
- Final verification with `npm run test`, `npm run typecheck`, `npm run build`, and `npm run gate:commit`
