# Feature Spec

## Story

- Story ID: `TTB-WF-003`
- Title: branch tracker and story-branch workflow

## Problem statement

The repo requires story-scoped branches, but it does not keep a checked-in registry of which branches are active, what each branch is for, or where each branch is in its lifecycle. Branch descriptions, publication state, and closeout notes currently live in people’s heads, in ad hoc commit subjects, or in GitHub PR metadata. That makes parallel work harder to recover from checked-in state alone.

## User-facing outcomes

- Opening a new story branch also records a canonical branch entry with a description and lifecycle metadata.
- Branch lifecycle updates use one checked-in tracker instead of scattered notes.
- Commit and push gates fail when the current branch is missing from the branch tracker.
- The tracker distinguishes local-only, published, draft-PR, ready-PR, merged, and abandoned states.
- The workflow keeps `docs/process/SINGLE_SOURCE_OF_TRUTH.md` focused on stories while `docs/process/BRANCH_TRACKER.md` owns branch inventory.

## Acceptance criteria

1. The repo has a checked-in branch tracker document under `docs/process/` with explicit status vocabulary and canonical table structure.
2. The repo exposes a helper command for branch open, update, and close actions that updates the branch tracker.
3. Opening a branch through the helper requires a branch description and records the new branch in the active tracker.
4. Updating branch status or PR metadata through the helper updates the same branch row instead of creating duplicates.
5. Closing a branch through the helper moves the branch from the active table to a closed-history table with final status and notes.
6. The commit and push gates fail when the current story branch is missing from the active branch tracker or has a placeholder description.
7. The workflow docs explain the split between `SINGLE_SOURCE_OF_TRUTH.md` and `BRANCH_TRACKER.md` clearly enough that either agent can recover the expected source of truth.
8. Existing story-branch protections stay intact: no new direct-work path on `main` or `production`, and no weakening of PR-only integration.

## Edge cases

- Existing unrelated work on other branches or worktrees must remain untouched.
- Branch tracker rows should be stable and human-readable, not generated into unreadable JSON blobs.
- Branch descriptions should tolerate punctuation, but the table format must remain valid.
- The helper should refuse to open a branch from a dirty worktree so users do not accidentally drag unrelated changes into a new story branch.

## Out of scope

- Runtime application behavior
- Validator, extraction, or API changes
- GitHub-side bot automation that rewrites `main`
