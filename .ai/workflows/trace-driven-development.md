# Trace-Driven Development Workflow

## Purpose

Tune prompt, model, tool-call, and agentic behavior through repeatable traced runs and LangSmith inspection until the story is consistently meeting its acceptance target.

## Step 1: Start from the packet

Read:

- active acceptance criteria
- `eval-brief.md`
- `trace-brief.md` when present

Define the exact failure pattern you are trying to eliminate.

## Step 2: Bootstrap LangSmith

Run:

- `npm run env:bootstrap`
- `npm run langsmith:smoke`

If the smoke test fails, stop and fix local auth before continuing.

## Step 3: Keep the slice small

- Choose the narrowest fixture or command that reproduces the issue.
- Do not start with a broad full-suite trace run when a smaller slice will do.

## Step 4: Keep TDD in front

- Add or strengthen deterministic tests before implementation where possible, using `docs/process/TEST_QUALITY_STANDARD.md` for layer choice, contract seams, property tests, and flake control.
- Force a RED state for the testable part of the story before changing code.

## Step 5: Run one traced pass

- Enable tracing only for the command you are about to run.
- Do not leave `LANGSMITH_TRACING=true` as a standing default.
- Use only approved local fixtures or sanitized inputs.

## Step 6: Inspect traces and runs

Use LangSmith to inspect:

- experiment sessions when the traced command is a `langsmith/vitest` eval
- eval root runs inside that experiment
- root surface spans versus child LLM-only spans
- individual LLM runs
- tool-call sequence
- retries and fallback branches
- schema adherence and parse failures
- stage timing summaries for extraction and deterministic follow-on work

For `langsmith/vitest` evals, the inspection path is: experiment session -> eval root run -> nested route-surface span -> stage spans.

## Step 7: Change one variable

Adjust one item at a time:

- prompt or instructions
- model
- schema descriptions
- tool routing
- retry logic
- fallback behavior

## Step 8: Re-run for consistency

- Re-run the same slice after each change.
- Do not stop on a single lucky pass.
- Keep the winning change only when it is repeatably better.

## Step 9: Record the result

Update:

- `trace-brief.md`
- `evals/results/`
- packet docs and memory files when durable truth changed

Record the winning experiment session ids, surface run ids, surface-span names, stage timings, and what changed.

## Exit criteria

- The trace target is stable enough to move forward.
- Deterministic tests, evals, and trace evidence agree.
- Tracing is turned back off outside the explicit local run.
