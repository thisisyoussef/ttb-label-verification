# Task Breakdown

1. Expand the compact packet for `TTB-202`.
   - Validation: packet includes feature, technical, privacy, and performance docs

2. Add RED tests for optional application-data intake and normalization.
   - Files: `src/server/index.test.ts`, `src/server/review/review-intake.test.ts`
   - Validation: targeted Vitest run fails before implementation

3. Extract request parsing and normalization into `src/server/review/review-intake.ts`.
   - Validation: targeted Vitest run passes

4. Make standalone intake tolerate omitted `fields`, and omit that part from the client request when no application data exists if needed.
   - Validation: route tests and typecheck pass

5. Record privacy and latency notes, then update tracker and handoff progress.
   - Files: `docs/specs/TTB-202/privacy-checklist.md`, `docs/specs/TTB-202/performance-budget.md`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/backlog/codex-handoffs/TTB-102.md`

6. Run final verification.
   - Commands:
     - `npm run test`
     - `npm run typecheck`
     - `npm run build`
