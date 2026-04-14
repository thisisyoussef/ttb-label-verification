# Technical Plan

## Primary files

- `src/shared/contracts/review.ts`
- `src/shared/contracts/review.test.ts`
- `src/client/types.ts` if report-type aliasing is needed

## Approach

1. Replace the old top-level `overallStatus` / `recommendation` scaffold with the richer report model approved in `docs/backlog/codex-handoffs/TTB-102.md`.
2. Export the new evidence-related schemas and inferred types from `src/shared/contracts/review.ts` so downstream stories can reuse them directly.
3. Keep one migrated seed report in the shared contract module. The seed should cover:
   - verdict + counts
   - comparison evidence on a regular checklist row
   - warning evidence with canonical sub-check ordering and diff segments
   - at least one cross-field check
4. Add explicit schema tests for:
   - migrated seed report
   - standalone mode with `comparison.status === 'not-applicable'`
   - no-text-extracted state with empty `checks`

## Risks

- The worktree is already dirty, including files related to `TTB-202`. Changes must stay narrow and avoid trampling upload-intake work.
- The current client duplicates the report shape in `src/client/types.ts`. Leaving it untouched risks immediate drift after the contract expands.
- Warning sub-check order is semantically important to the UI. The contract should reject out-of-order arrays rather than trusting callers.

## Validation plan

- RED: run targeted contract tests after adding the new assertions
- GREEN: update the shared schema and any type aliases until targeted tests pass
- Final: `npm run test`, `npm run typecheck`, `npm run build`
