# Task Breakdown

1. Define the latency span contract.
   - Objective: add the internal timing model and safe-summary rules for the review pipeline.
   - Files: `src/server/review/review-latency.ts`, tests
   - Validation: monotonic stage ordering, bounded metadata only

2. Wire timing into the real route and batch seams.
   - Objective: capture stage timings for single-label routes and per-item batch execution.
   - Files: `src/server/index.ts`, `src/server/batch/batch-session.ts`, provider extractors
   - Validation: route and batch tests prove timing presence on success/fallback/error paths

3. Publish the sub-4-second target envelope.
   - Objective: record the stage budgets and late-fail rule without yet flipping the visible contract target.
   - Files: `performance-budget.md`, `eval-brief.md`
   - Validation: packet clearly separates measurement work from the later optimization story

4. Lock privacy and handoff rules.
   - Objective: prove the timing path does not create a new persistence or logging leak.
   - Files: `privacy-checklist.md`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
   - Validation: SSOT marks the follow-on optimization story as the actual cutover step
