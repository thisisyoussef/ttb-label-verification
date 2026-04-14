# Story Lookup Workflow

## Purpose

Turn a task into a grounded implementation brief before code changes begin.

## When to run

Run before meaningful implementation for any non-trivial task.

## Steps

1. Read `AGENTS.md`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, the presearch, and the active contract files.
2. If the task is moving into real implementation work, confirm the current branch is story-scoped. When the worktree is on `main` or `production`, cut the story branch before proceeding with packet or code edits.
3. Inspect the nearest relevant code and docs in this repo.
4. Build a blast-radius map from the files, symbols, routes, selectors, fixtures, state transitions, and docs you expect to touch. Search for direct dependents before coding.
5. If the task touches client shell or flow surfaces, inspect dependent guided-help surfaces too: help manifest or fixture sources, help runtime, replay state, guided-tour runtime, help route tests, and affected `data-tour-target` anchors.
6. Identify authoritative external sources when the task depends on TTB rules, OpenAI API behavior, or unfamiliar integration details.
7. Produce a concise lookup brief with:
   - local findings
   - blast radius and dependent flows
   - external findings when needed
   - implementation implications
   - test implications
   - open questions

## Exit criteria

- Lookup brief exists in chat or in the active spec packet before coding starts.
- Story implementation does not begin on `main` or `production`.
