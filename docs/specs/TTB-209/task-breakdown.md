# Task Breakdown

1. Establish the optimized baseline.
   - Objective: use `TTB-208` timing spans to identify the actual dominant latency legs.
   - Files: `evals/results/*`, `trace-brief.md`
   - Validation: packet records the baseline timings before changes

2. Tune provider/model/request profiles.
   - Objective: right-size the Gemini primary and OpenAI fallback paths for the single-label route.
   - Files: extractor modules, env/config wiring
   - Validation: timing drops without breaking extraction quality

3. Enforce the fallback deadline.
   - Objective: prevent second-provider attempts that cannot still finish inside the target window.
   - Files: `src/server/review/review-latency.ts`, route wiring
   - Validation: forced late-fail tests return retryable errors inside budget

4. Cut the visible contract over to `4000`.
   - Objective: update the shared contract, report builder, and seed fixtures only after proof exists.
   - Files: `src/shared/contracts/review-base.ts`, `src/shared/contracts/review-seed.ts`, `src/server/review/review-report.ts`
   - Validation: contract tests and fixtures align on the new ceiling

5. Record final latency evidence.
   - Objective: publish the winning profile, timing proof, and rollback condition.
   - Files: `performance-budget.md`, `eval-brief.md`, `trace-brief.md`, `evals/results/*`
   - Validation: `TTB-401` can treat the latency target as a completed prerequisite instead of an open question
