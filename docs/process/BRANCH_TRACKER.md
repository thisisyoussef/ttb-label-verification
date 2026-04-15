# Branch Tracker

Last updated: 2026-04-15

This file is the checked-in branch registry for normal story work.

- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` remains the canonical tracker for story order, lane ownership, and handoff state.
- This file is the canonical tracker for branch lifecycle metadata: branch name, story id, description, status, PR state, and closeout notes.
- The published copy on `main` is the canonical shared view. Story branches must update their own row as soon as they are opened so the tracker merges forward cleanly.
- Use `npm run story:branch -- open ...`, `update ...`, and `close ...` instead of editing the active table by hand unless the helper is blocked.

## Status vocabulary

- `draft-local`: branch exists locally but is not yet published
- `published`: branch is pushed and has no PR yet
- `draft-pr`: branch has a draft PR
- `ready-pr`: branch has a non-draft PR open to `main`
- `merged`: branch merged to `main`
- `abandoned`: branch intentionally closed without merge

## Active branches

<!-- ACTIVE_BRANCHES:START -->
| Branch | Story | Lane | Status | Description | PR | Opened | Updated | Base | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `chore/TTB-WF-003-branch-tracker` | `TTB-WF-003` | `chore` | `draft-local` | add the branch tracker workflow and enforce branch metadata updates | - | `2026-04-15` | `2026-04-15` | `main` | isolated workflow worktree |
| `claude/TTB-000-fix-toolbench-scroll` | `TTB-000` | `claude` | `open` | fix toolbench scroll — move overflow to tabpanel | #45 | `2026-04-15` | `2026-04-15` | `main` | - |
<!-- ACTIVE_BRANCHES:END -->

## Closed branches

<!-- CLOSED_BRANCHES:START -->
| Branch | Story | Lane | Final status | Description | Closed | Notes |
| --- | --- | --- | --- | --- | --- | --- |
<!-- CLOSED_BRANCHES:END -->
