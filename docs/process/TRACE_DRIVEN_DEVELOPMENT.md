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

LangSmith tracing is development-only in this repo.

- Keep `LANGSMITH_TRACING=false` by default.
- Turn tracing on only for the exact local command you are about to run.
- Use only approved local fixtures or sanitized inputs.
- Do not trace staging or production user submissions.
- Do not treat external trace storage as compatible with the product's no-persistence runtime guarantee.

## Required setup

1. Run `npm run env:bootstrap`.
2. Run `npm run langsmith:smoke`.
3. Confirm the story packet includes `eval-brief.md` when the change affects AI behavior.
4. Add `trace-brief.md` when the story needs real trace-driven tuning work.

## Recommended packet additions

For trace-driven stories, add or update:

- `docs/specs/<story-id>/trace-brief.md`
- `docs/specs/<story-id>/eval-brief.md`
- `evals/results/<story-id>-<date>.md`

`trace-brief.md` should capture:

- the hypothesis being tested
- the fixture slice or commands being run
- the exact review focus in LangSmith
- the failure taxonomy
- the winning traces and what changed

## Loop

1. Start from the packet

- Read acceptance criteria, `technical-plan.md`, `eval-brief.md`, and `trace-brief.md`.
- Decide what "better" means before you run traces.

2. Choose the smallest traced slice

- Use the narrowest fixture set that can reveal the failure.
- Prefer repeatable local runs over broad manual exploration.

3. Keep TDD in front

- Add or strengthen deterministic tests first where possible, using `docs/process/TEST_QUALITY_STANDARD.md` for layer choice, contract seams, property tests, and flake control.
- Force a RED state before implementation for behavior that should be testable.

4. Run one traced pass

- Enable tracing only for that command.
- Example:

```bash
LANGSMITH_TRACING=true npm run <story-specific-command>
```

5. Inspect LangSmith

Useful CLI commands:

```bash
langsmith project list --format pretty
langsmith trace list --project "$LANGSMITH_PROJECT" --limit 10 --format pretty
langsmith trace get <trace-id> --project "$LANGSMITH_PROJECT" --full --format pretty
langsmith run list --project "$LANGSMITH_PROJECT" --run-type llm --limit 20 --format pretty
```

Look for:

- prompt drift
- schema mismatch
- weak tool selection
- retry loops
- brittle reasoning paths
- inconsistent extraction on the same fixture

6. Change one variable at a time

- prompt
- model
- schema description
- tool routing
- fallback logic
- retry policy

Do not mix unrelated changes into the same trace iteration.

7. Re-run until stable

- Re-run the same slice after each change.
- Prefer consistent behavior across repeated runs over one lucky output.

8. Record the result

Update the packet and eval result with:

- LangSmith project name
- endpoint surface
- provider
- prompt profile or prompt-policy version
- guardrail policy version
- key trace ids
- what changed between iterations
- final decision and why it won
- remaining failure modes or open questions

When traces support an endpoint-aware eval or scorecard review, also record:

- the endpoint slice that was exercised
- the personas being judged in that run
- whether the run was tracked or dry-run only

## Exit criteria

- The trace goal in `trace-brief.md` is resolved or explicitly deferred.
- The winning behavior is backed by deterministic tests where possible.
- Relevant eval results are recorded in `evals/results/`.
- The packet documents the winning traces and remaining risk.
- Tracing is no longer left enabled by default after the run.
