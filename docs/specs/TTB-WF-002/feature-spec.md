# Feature Spec

## Story

- Story ID: `TTB-WF-002`
- Title: source cleanup and reviewer-oriented refactor pass

## Problem statement

Several client, server, and tooling files are nearing or already above the repo's 500-line cap and mix multiple responsibilities. The code still works, but it is harder to review because state orchestration, UI sections, drag-and-drop behavior, and service lifecycle logic are concentrated in a small number of large files. The repo needs a mechanical guard that blocks new line-count debt while freezing inherited oversized files until follow-up cleanup lands.

## User-facing outcomes

- Reviewers of the codebase can understand major flows from smaller, more focused modules.
- Runtime behavior stays the same.
- Repeated client-side file-picker and drag/drop behavior is shared instead of duplicated.
- The repo enforces the 500-line source-file cap for new or growing runtime and tooling files.

## Acceptance criteria

1. No new file under `src/` or `scripts/` exceeds 500 lines, and any inherited oversized file is frozen in `scripts/quality/source-size-baseline.json` at its checked-in allowance.
2. Large multi-responsibility files are split along existing architectural seams rather than by arbitrary naming churn.
3. Shared drag/drop and picker behavior is extracted so the batch upload surfaces do not duplicate the same interaction logic.
4. Batch workflow and batch session orchestration read as composition roots over helpers instead of as monolithic implementations.
5. The refactor does not intentionally change product behavior or relax privacy constraints.
6. The repo includes a guard command that fails when a runtime or tooling file newly exceeds the 500-line cap or when a baseline-listed file grows beyond its checked-in allowance.

## Edge cases

- Reference docs may remain above 500 lines because they are canonical product documentation, not runtime/source files.
- Existing in-flight work on other branches or worktrees must remain untouched.
- Refactors should not create deep folder nesting or barrel-file indirection.

## Out of scope

- New product features
- New UI direction or copy exploration
- Shared contract redesign
- AI, validator, or deployment behavior changes
