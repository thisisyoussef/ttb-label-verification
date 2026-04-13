# Story Lookup Workflow

## Purpose

Turn a task into a grounded implementation brief before code changes begin.

## When to run

Run before meaningful implementation for any non-trivial task.

## Steps

1. Read `AGENTS.md`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, the presearch, and the active contract files.
2. Inspect the nearest relevant code and docs in this repo.
3. Identify authoritative external sources when the task depends on TTB rules, OpenAI API behavior, or unfamiliar integration details.
4. Produce a concise lookup brief with:
   - local findings
   - external findings when needed
   - implementation implications
   - test implications
   - open questions

## Exit criteria

- Lookup brief exists in chat or in the active spec packet before coding starts.
