# Codex From UI Handoff

## Purpose

Define how Codex picks up an approved Claude UI handoff, completes the missing spec packet, and ships engineering work from that UI starting point without needing a new Claude pass for every follow-on refinement.

## Entry criteria

- `docs/backlog/codex-handoffs/<story-id>.md` exists
- the handoff status is `ready-for-codex`
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` either names the story as the active/blocking Codex story or explicitly marks it executable for Codex (for example `ready-parallel`)
- the user already approved the UI direction

## Steps

1. Before any packet or implementation edits, confirm the current branch is story-scoped for this handoff. If the worktree is on `main` or `production`, immediately switch to `codex/<story-id>-<summary>` and continue there.
2. Read `AGENTS.md`, `CLAUDE.md`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/process/CODEX_CHECKLIST.md`, `docs/specs/<story-id>/ui-component-spec.md`, and the active backlog handoff.
3. Translate the approved UI into the missing packet docs under `docs/specs/<story-id>/`:
   - `constitution-check.md`
   - `feature-spec.md`
   - `technical-plan.md`
   - `task-breakdown.md`
   - `evidence-contract.md` when payload or detail structure changes
   - `rule-source-map.md` when validator logic or citations change
   - `privacy-checklist.md` when uploads, model calls, or ephemeral data handling change
   - `performance-budget.md` when the single-label critical path changes
   - `eval-brief.md` when model behavior changes
4. Derive tests from the accepted behavior and the relevant eval cases using `docs/process/TEST_QUALITY_STANDARD.md`, then run the TDD pipeline.
5. Implement the engineering work behind the established UI:
   - shared contracts
   - server endpoints
   - extraction pipeline
   - deterministic validators
   - tests and tooling
6. You may edit `src/client/**` when that helps integration, correctness, usability, or maintainability. Those edits may include copy, layout, styling, interaction, and component-structure refinements, as long as they stay aligned with `docs/design/MASTER_DESIGN.md`, the story packet, and the handoff's hard constraints. If the needed change is a broader redesign, a new screen concept, or a fresh Stitch/user-review loop, record it in the backlog handoff and stop for Claude.
7. Update the handoff status, source-of-truth doc, rule-source index, eval result, and relevant memory docs as the story moves, especially when Codex makes material UI refinements.
8. Finish with QA-style handoff and final acceptance handoff.

## Output

- completed engineering packet in `docs/specs/<story-id>/`
- updated backlog handoff with status and any residual UI follow-ups
- verified implementation with tests, typecheck, and build
- story-scoped branch in use before Codex implementation starts
