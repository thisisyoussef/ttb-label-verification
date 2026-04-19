# Trace-Driven Development Workflow

## Purpose

Tune prompt, model, tool-call, and agentic behavior through repeatable local runs until the story is consistently meeting its acceptance target.

## Step 1: Start from the packet

Read:

- active acceptance criteria
- `eval-brief.md`
- `trace-brief.md` when present

Define the exact failure pattern you are trying to eliminate.

## Step 2: Prepare the local loop

Run:

- `npm run env:bootstrap`

Choose the smallest local fixture or eval command that exercises the problem.

## Step 3: Keep the slice small

- Choose the narrowest fixture or command that reproduces the issue.
- Do not start with a broad full-suite run when a smaller slice will do.

## Step 4: Keep TDD in front

- Add or strengthen deterministic tests before implementation where possible, using `docs/process/TEST_QUALITY_STANDARD.md` for layer choice, contract seams, property tests, and flake control.
- Force a RED state for the testable part of the story before changing code.

## Step 5: Run one local pass

- Use only approved local fixtures or sanitized inputs.
- Prefer fixture-backed evals, route probes, or focused Vitest commands.

## Step 6: Inspect evidence

Inspect:

- failing expectations and diff output
- stage timing summaries
- provider/model metadata
- retry or fallback behavior visible locally
- repeated-run consistency on the same fixture

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

Record the winning commands, fixture slice, local timing evidence, and what changed.

## Exit criteria

- The trace target is stable enough to move forward.
- Deterministic tests, evals, and local evidence agree.
- No external trace dependency is required to repeat the result.
