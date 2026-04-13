# Codex From UI Handoff

## Purpose

Define how Codex picks up an approved Claude UI handoff, completes the missing spec packet, and ships engineering work without changing the frontend design.

## Entry criteria

- `docs/backlog/codex-handoffs/<story-id>.md` exists
- the handoff status is `ready-for-codex`
- the user already approved the UI direction

## Steps

1. Read `AGENTS.md`, `CLAUDE.md`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/process/CODEX_CHECKLIST.md`, `docs/specs/<story-id>/ui-component-spec.md`, and the active backlog handoff.
2. Translate the approved UI into the missing packet docs under `docs/specs/<story-id>/`:
   - `constitution-check.md`
   - `feature-spec.md`
   - `technical-plan.md`
   - `task-breakdown.md`
   - `evidence-contract.md` when payload or detail structure changes
   - `rule-source-map.md` when validator logic or citations change
   - `privacy-checklist.md` when uploads, model calls, or ephemeral data handling change
   - `performance-budget.md` when the single-label critical path changes
   - `eval-brief.md` when model behavior changes
3. Derive tests from the accepted behavior and the relevant eval cases, then run the TDD pipeline.
4. Implement only the engineering work behind the frozen UI:
   - shared contracts
   - server endpoints
   - extraction pipeline
   - deterministic validators
   - tests and tooling
5. Do not edit `src/client/**`, design files, or frontend copy. If a UI change becomes necessary, add it back to the backlog handoff and stop for Claude.
6. Update the handoff status, source-of-truth doc, rule-source index, eval result, and relevant memory docs as the story moves.
7. Finish with QA-style handoff and final acceptance handoff.

## Output

- completed engineering packet in `docs/specs/<story-id>/`
- updated backlog handoff with status and any residual UI follow-ups
- verified implementation with tests, typecheck, and build
