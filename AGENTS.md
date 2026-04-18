# AGENTS

This file is the canonical operating contract for this repo. Keep it lean.

## Core read order

1. `AGENTS.md`
2. `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
3. `docs/process/GIT_HYGIENE.md`
4. `docs/process/BRANCH_TRACKER.md`
5. `CLAUDE.md`
6. `.ai/docs/WORKSPACE_INDEX.md`
7. `docs/specs/FULL_PRODUCT_SPEC.md` when the task changes product behavior
8. `src/shared/contracts/review.ts` when the task changes the UI/API boundary

## Non-negotiables

- Build from checked-in docs and code, not from chat memory.
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` is the canonical checked-in tracker for active story, status, and next step.
- `docs/process/BRANCH_TRACKER.md` is the canonical checked-in tracker for branch lifecycle metadata.
- `.ai/memory/**` is the memory bank. Keep it concise and aligned with checked-in truth.
- Default to TDD, DRY, small modules, clear names, and single-purpose files.
- No uploaded label image, application data, or verification result may be persisted.
- OpenAI integrations must use the Responses API with `store: false`.
- Final compliance outcomes must come from deterministic rules and typed contracts.
- Low-confidence visual claims default to `review`.
- The single-label cloud path keeps its `<= 5,000 ms` public target unless a later measured story changes it.

## Agent model

- Claude and Codex are both full agents for this repo.
- Either agent may work in `src/client/**`, `src/server/**`, `src/shared/**`, tests, tooling, infra, and docs when the story requires it.
- Existing story packets, design docs, and historical handoff docs are context, not standing ownership gates.
- Redirect only for real blockers: explicit user review, missing returned assets, unavailable credentials or tooling that cannot be recovered locally, or a manual release step the user must authorize.
- Historical `docs/backlog/codex-handoffs/**` files remain useful context for older stories, but they are not a default prerequisite for new work.

## Story flow

- Non-trivial work starts with preflight and a quick lookup of the real code and docs.
- `continue` and `next story` resolve from SSOT, not chat memory.
- Do the work directly on a fresh story branch by default.
- Specs are optional. Create or update docs under `docs/specs/<story-id>/` only when the work is large, ambiguous, cross-cutting, risky, or the user asks for planning artifacts.
- When a task is small and clear, implement directly and keep the documentation update proportional.
- Before implementation, map the blast radius for touched routes, contracts, fixtures, evals, and adjacent flows instead of assuming the change is local.
- Old UI-first packets and handoff files may still explain earlier design decisions, but they do not block direct execution unless the story explicitly says it is waiting on user approval or missing assets.

## Communication

- Keep in-progress updates short and action-oriented.
- Do not narrate internal reasoning, speculative continuity clues, or tracker inconsistencies unless they materially block the work.
- Treat routine env-sync recovery in a linked worktree as operational detail. Run it or let the branch helper run it, and mention it only when live work is still blocked afterward.
- If checked-in docs disagree and the correction is obvious, fix the docs and report the correction plainly instead of talking through the intermediate analysis.
- Avoid lane-resolution chatter, agent-role chatter, and status noise in user-facing updates unless the user explicitly asks for workflow debugging.

## Branch and worktree rules

- Before a new task, check the current branch.
- Never start new story work on `main`, `production`, or an unrelated story branch.
- Default path: create or switch to a fresh story branch in the current checkout and do the work there.
- Use a linked worktree only when you need true parallel branches or the current checkout is dirty and you do not want to disturb it.
- Do not create linked worktrees inside the repo root. Use sibling directories, not nested paths like `.claude/worktrees/**`.
- Every active worktree must still be attached to a real Git branch that can be pushed and merged through GitHub.
- A new linked worktree should leave branch creation with a repo-local `.env` bootstrapped already. If you reopen an older isolated worktree or the env drifts, run `npm run env:bootstrap` before live model, API, batch, or browser verification work.
- When returning to an in-progress task, go back to that branch; reopen its worktree only if you isolated it that way.
- Record every story branch in `docs/process/BRANCH_TRACKER.md`.
- Merge reviewable story branches to `main` through GitHub PRs when done unless the user explicitly asks to hold them or a concrete blocker exists.

## Git workflow

- Prefer `npm run story:branch -- open ...` for fresh story work.
- Add `--worktree ../<repo>-<suffix>` only when you want an isolated parallel checkout.
- Run `npm run gate:commit` before reviewable commits.
- Run `npm run gate:push` before reviewable pushes.
- Run `npm run gate:publish` before claiming a branch is on GitHub.
- Do not push directly to `main` or `production` for story work.
- When a story is done and mergeable, do not stop at a local commit. Push the branch, open or update the GitHub PR, and merge it unless the user explicitly asks to hold it or a concrete blocker exists.

## Verification

- Start with focused RED tests for non-trivial behavior or tooling changes.
- Run the smallest useful focused tests while iterating.
- When a feature changes visible, repeatable, or API-backed behavior, finish with an end-to-end verification pass before handoff:
  - exercise the real API path with non-default inputs
  - click through the real user flow in a real browser using Comet
  - confirm the UI reflects the live response rather than fixture-only behavior
- Before handoff, run:
  - `npm run test`
  - `npm run typecheck`
  - `npm run build`

## Memory updates after work

Refresh the smallest set needed:

- `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- `docs/process/BRANCH_TRACKER.md`
- `.ai/memory/project/patterns.md`
- `.ai/memory/project/anti-patterns.md`
- `.ai/memory/project/technical-debt.md`
- `.ai/memory/session/active-context.md`
- `.ai/memory/session/decisions-today.md`
- `.ai/memory/session/blockers.md`

## Delivery

Final handoff should say what changed, how the new flow works, what remains risky, how to verify it, and whether the branch is already pushed and merged. Do not call mergeable story work complete while it is still only local.
