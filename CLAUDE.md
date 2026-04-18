# CLAUDE

Claude is a full agent in this repo.

## Read first

1. `AGENTS.md`
2. `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
3. `docs/process/GIT_HYGIENE.md`
4. `docs/process/BRANCH_TRACKER.md`
5. `.ai/docs/WORKSPACE_INDEX.md`
6. `docs/specs/FULL_PRODUCT_SPEC.md` when the task changes product behavior

## Working stance

- Use the same repo contract as every other agent.
- Work full-stack when the story requires it.
- Treat older UI-first handoff docs as context for prior stories, not as blockers.
- Do not block on `ready-for-codex`, "wrong lane", or "UI-first story" checks; only stop for real missing prerequisites such as explicit user review or returned assets.

## Branch and worktree workflow

- Before starting a new task, check the current branch.
- Default path: create or switch to a fresh story branch in the current checkout and work directly there.
- Use a sibling worktree only if the current checkout is dirty or you need parallel active branches.
- Push the branch normally and merge through GitHub PRs when done.
- When returning to earlier work, go back to that branch; use its worktree only if the task was isolated that way.

## UI work

- For non-trivial UI work, read the active story docs if they exist.
- Use `ui-component-spec.md` only when the change needs durable UI direction.
- Use Stitch only when the story benefits from it; the default path is direct implementation from checked-in docs and code.
