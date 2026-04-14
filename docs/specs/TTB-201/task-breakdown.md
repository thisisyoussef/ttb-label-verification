# Task Breakdown

1. Expand the compact packet into the standard Codex packet for `TTB-201`.
   - Validation: packet files exist and reflect the approved `TTB-102` handoff

2. Add RED tests for the richer review contract.
   - Files: `src/shared/contracts/review.test.ts`
   - Validation: targeted Vitest run fails before implementation

3. Expand `src/shared/contracts/review.ts` to the approved evidence model and migrate the seed fixture.
   - Validation: targeted Vitest run passes

4. Reduce client/shared report-type drift if a narrow aliasing change is sufficient.
   - Files: `src/client/types.ts`
   - Validation: `npm run typecheck`

5. Record the evidence-model eval result and sync story tracking.
   - Files: `docs/specs/TTB-201/eval-brief.md`, `evals/results/2026-04-13-TTB-201.md`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/backlog/codex-handoffs/TTB-102.md`

6. Run final verification.
   - Commands:
     - `npm run test`
     - `npm run typecheck`
     - `npm run build`
