# Constitution Check

## Story

- Story ID: `TTB-303`
- Title: batch input append and toolbench mode-routing regression fix
- Parent: `TTB-003`
- Primary lane: Codex

## Scope classification

- Codex-only bug-fix story on established batch UI surfaces.
- No new screen design or workflow concept is introduced; this is a correctness and usability follow-up to `TTB-302`.

## Non-negotiable constraints

1. Batch uploads, CSV rows, session state, and exports remain in memory only.
2. The approved batch UI direction from `TTB-103` and `TTB-104` remains intact.
3. Toolbench fixture support may assist the workflow, but it must not silently change the active review mode or reintroduce fixture-first batch behavior.
4. Behavior changes require RED tests first and full repo validation before handoff.

## Why this story exists

`TTB-302` made batch live-first, but two reviewer-visible regressions remain:

- using `Add more` on batch images replaces the current image set instead of appending
- loading an image directly from the toolbench while batch is active routes the workstation back to single review

This story closes those regressions without reopening the broader batch architecture.
