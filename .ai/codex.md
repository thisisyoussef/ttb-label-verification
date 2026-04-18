# Codex Harness

This file mirrors the repo's lean execution contract for Codex.

## Read first

1. `AGENTS.md`
2. `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
3. `docs/process/GIT_HYGIENE.md`
4. `docs/process/BRANCH_TRACKER.md`
5. `.ai/docs/WORKSPACE_INDEX.md`
6. `docs/specs/FULL_PRODUCT_SPEC.md` when behavior changes
7. `src/shared/contracts/review.ts` when contract wiring changes

## Default loop

1. Run preflight for non-trivial work.
2. Run story lookup.
3. Decide whether the task needs a spec update or can be implemented directly.
4. Default to a fresh story branch in the current checkout. If the checkout is dirty or you need parallel active branches, create a sibling worktree from `origin/main`.
5. Record the branch in `docs/process/BRANCH_TRACKER.md`.
6. Update or create `docs/specs/<story-id>/` only when the work is large, ambiguous, risky, or explicitly asks for planning docs.
7. Work TDD-first.
8. Update SSOT and memory when durable truth changes.
9. Verify with `npm run test`, `npm run typecheck`, and `npm run build`.

## What matters

- TDD and clean code over process sprawl
- SSOT and memory bank stay current
- Fresh story branch by default
- Optional worktrees for true parallelism or dirty checkout isolation
- No nested worktrees inside the repo
- GitHub PR path for publish and merge
- No standing Claude-vs-Codex lane split
