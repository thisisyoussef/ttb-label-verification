# Git Hygiene

This repo uses story branches by default. Linked worktrees are optional when you truly need parallel active branches.

## Core rules

- Do not start new story work on `main`, `production`, or an unrelated story branch.
- Default path: create or switch to a fresh story branch in the current checkout and do the work there.
- If the current checkout is dirty or you need true parallel active branches, create a sibling worktree from `origin/main`.
- Do not create linked worktrees inside the repo root.
- Every worktree branch should be publishable to GitHub and merge through a PR.

## Recommended commands

Create a fresh story branch in the current clean checkout:

```bash
npm run story:branch -- open --lane codex --story TTB-210 --summary prompt-guardrails --description "tighten prompt guardrails"
```

Optional: create a fresh story branch in a sibling worktree from the latest `origin/main`:

```bash
npm run story:branch -- open --lane chore --story TTB-WF-003 --summary lean-agent-workspace --description "simplify agent docs and make worktrees first-class" --worktree ../ttb-label-verification-wf-003-lean
```

Update branch metadata:

```bash
npm run story:branch -- update --status published --pr "#123"
```

Close a merged or abandoned branch:

```bash
npm run story:branch -- close --final-status merged --notes "merged via PR #123"
```

Clean up a finished linked worktree:

```bash
git worktree remove ../ttb-label-verification-wf-003-lean
git worktree prune
```

## Worktree practice

- Use sibling directories such as `../ttb-label-verification-<suffix>`.
- `npm run story:branch -- open ... --worktree <path>` writes the branch tracker row in the new worktree instead of dirtying the current one.
- `npm run story:branch -- open ... --worktree <path>` also bootstraps the new worktree's repo-local `.env` from the local gauntlet env inventory when credentials are available.
- If you reopen an older isolated worktree or its repo-local env has drifted, run `npm run env:bootstrap` before live model, API, batch, or browser verification work.
- If you need to resume existing work, reopen that worktree and keep its branch attached there.
- Nested paths like `.claude/worktrees/**` are not allowed for linked worktrees.

## Commit, push, and publish gates

- Run `npm run gate:commit` before reviewable commits.
- Run `npm run gate:push` before reviewable pushes.
- Run `npm run gate:publish` before claiming a branch is on GitHub.
- `main` and `production` are integration branches, not story branches.
- The source-size guard now freezes inherited oversized files at their checked-in line counts through `scripts/source-size-baseline.json`; new oversized files or growth beyond that baseline still fail the gate.
- The branch-tracker gate also accepts the current branch in closed history during that branch's own final closeout commit and push, so the tracker can be finalized without bypassing hooks.

## PR and merge path

- Push the story branch.
- Keep the PR body accurate and production-grade.
- Merge through GitHub PRs.
- When the story is done and mergeable, agents should run this push and merge path by default instead of waiting for a separate user prompt.
- Delete the worktree after the branch is merged or intentionally abandoned.
