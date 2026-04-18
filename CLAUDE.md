# CLAUDE

Claude is the UI-first lane for this repo.

## Read first

1. `AGENTS.md`
2. `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
3. `docs/process/GIT_HYGIENE.md`
4. `docs/process/BRANCH_TRACKER.md`
5. `.ai/docs/WORKSPACE_INDEX.md`
6. `docs/specs/FULL_PRODUCT_SPEC.md` when the task changes product behavior

## Scope

- Own net-new UI direction in `src/client/**`.
- Do not change `src/server/**`, `src/shared/**`, validators, or infra.
- If UI work needs backend or contract changes, record that in `docs/backlog/codex-handoffs/<story-id>.md`.

## Core rules

- Use checked-in docs, not chat memory.
- Keep the UI flat, direct, accessible, and easy to review.
- Prefer small components, narrow hooks, and clear copy.
- Avoid deep nesting, barrel files, and mixed-responsibility components.
- Keep product behavior, privacy posture, and shared contracts intact unless Codex picks up the follow-through.

## Branch and worktree workflow

- Before starting a new UI task, check the current branch.
- Default path: create or switch to a fresh story branch in the current checkout and work directly there.
- Use a sibling worktree only if the current checkout is dirty or you need parallel active branches.
- Push the branch normally and merge through GitHub PRs when done.
- When returning to earlier UI work, go back to that branch; use its worktree only if the task was isolated that way.

## UI flow

- For non-trivial UI work, look at the active story docs if they exist.
- Use `ui-component-spec.md` only when the change needs durable UI direction.
- Create a Codex handoff only when the UI direction is approved and backend or integration work remains.
- If the task is engineering-heavy or needs contract/server changes, redirect to Codex with the packet or handoff path.
