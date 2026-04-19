# Trace-Driven Development

Use trace-driven development for prompt, model, tool-call, and agentic behavior that cannot be tuned confidently through deterministic tests alone.

This workflow complements, but does not replace:

- spec-driven development for defining the contract
- TDD for deterministic behavior and regressions
- evals for scenario-level pass/fail tracking

## When to use it

Run this workflow when a story changes any of the following:

- prompt wording or system instructions
- model selection
- structured-output shape that depends on model behavior
- tool-calling behavior
- agentic orchestration or retry logic
- grader or evaluator prompts
- extraction consistency where one green test run is not enough

Do not use this as a substitute for deterministic tests on validator logic, schema normalization, or pure transport code.

## Privacy rule

Trace-driven tuning is local-only in this repo.

- Use only approved local fixtures or sanitized inputs.
- Do not send trace data to an external service.
- Do not treat local debug metadata as compatible with the product's no-persistence runtime guarantee.
- Do not run trace-driven tuning on staging or production user submissions.

## Required setup

1. Run `npm run env:bootstrap`.
2. Confirm the story packet includes `eval-brief.md` when the change affects AI behavior.
3. Add `trace-brief.md` when the story needs real trace-driven tuning work.

## Recommended packet additions

For trace-driven stories, add or update:

- `docs/specs/<story-id>/trace-brief.md`
- `docs/specs/<story-id>/eval-brief.md`
- `evals/results/<story-id>-<date>.md`

`trace-brief.md` should capture:

- the hypothesis being tested
- the fixture slice or commands being run
- the exact local evidence to inspect
- the failure taxonomy
- the winning command/evidence and what changed

## Loop

1. Start from the packet

- Read acceptance criteria, `technical-plan.md`, `eval-brief.md`, and `trace-brief.md`.
- Decide what "better" means before you run anything.

2. Choose the smallest reproducible slice

- Use the narrowest fixture set that can reveal the failure.
- Prefer repeatable local runs over broad manual exploration.

3. Keep TDD in front

- Add or strengthen deterministic tests first where possible, using `docs/process/TEST_QUALITY_STANDARD.md` for layer choice, contract seams, property tests, and flake control.
- Force a RED state before implementation for behavior that should be testable.

4. Run one local tuning pass

- Use the smallest local command that exercises the behavior.
- Examples:

```bash
npm run eval:golden
npx vitest run src/server/review-relevance.test.ts
npx tsx scripts/stage-timings.ts --route review --fixture perfect-spirit-label
```

5. Inspect local evidence

Look at:

- fixture-backed eval failures or diff output
- stage timing summaries and `X-Stage-Timings` headers
- provider/model metadata returned by the route or packeted test output
- retry and fallback behavior visible in local logs or test assertions
- consistency across repeated runs on the same fixture

Look for:

- prompt drift
- schema mismatch
- weak tool selection
- retry loops
- brittle reasoning paths
- inconsistent extraction on the same fixture
- missing stage timing summaries that hide where latency actually moved

6. Change one variable at a time

- prompt
- model
- schema description
- tool routing
- fallback logic
- retry policy

Do not mix unrelated changes into the same tuning iteration.

7. Re-run until stable

- Re-run the same slice after each change.
- Prefer consistent behavior across repeated runs over one lucky output.

8. Record the result

Update the packet and eval result with:

- endpoint surface
- extraction mode
- provider
- prompt profile or prompt-policy version
- guardrail policy version
- exact commands run
- timing evidence or comparable local diagnostics
- what changed between iterations
- final decision and why it won
- remaining failure modes or open questions

## Exit criteria

- The tuning goal in `trace-brief.md` is resolved or explicitly deferred.
- The winning behavior is backed by deterministic tests where possible.
- Relevant eval results are recorded in `evals/results/`.
- The packet documents the winning local evidence and remaining risk.
