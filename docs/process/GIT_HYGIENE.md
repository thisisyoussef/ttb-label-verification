# Git Hygiene

This file defines the branch, commit, push, and merge gates for this repo.

The goal is simple:

- every branch maps cleanly to a story or tightly-coupled workflow change
- every commit is reviewable and intentional
- every push is safe to share
- `main` and `production` stay clean because they are deployment branches

Canonical local commands:

- `npm run gate:commit`
- `npm run gate:push`
- `npm run gate:publish`

## Branch gate

Use one working branch per story or tightly-coupled change set.

Recommended branch patterns:

- `claude/<story-id>-<short-summary>` for Claude-lane UI work
- `codex/<story-id>-<short-summary>` for Codex-lane engineering work
- `chore/<story-id>-<short-summary>` for workflow or harness work

Examples:

- `claude/TTB-102-results-ui`
- `codex/TTB-202-upload-intake`
- `chore/TTB-WF-001-git-hygiene-gates`

Rules:

- Never do story work directly on `main` or `production`.
- If you realize the worktree is already carrying story work on `main` or `production`, cut a story branch immediately with `git switch -c <lane>/<story-id>-<summary>` before the next commit.
- Starting a new feature, story, or tightly-coupled workflow item means opening a fresh branch is the first action before packet or code edits.
- Do not mix unrelated stories in one branch unless the tracker explicitly treats them as one coupled unit.
- If the worktree already contains unrelated changes, do not revert them. Stage only the files for the story you are committing.
- When the active story changes, create or switch to a fresh branch for that story immediately. Do not repurpose the old story branch, even if it is otherwise valid.
- Repo gates enforce branch naming. Normal work must use `claude/<story-id>-<summary>`, `codex/<story-id>-<summary>`, or `chore/<story-id>-<summary>`. `archive/` and `rewrite/` branches are exceptional maintenance paths only.

## Commit gate

Before each commit:

1. Confirm the staged diff belongs to one story or one coherent workflow change.
2. Sync the checked-in docs that changed with the code:
   - `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
   - the active packet under `docs/specs/<story-id>/`
   - `docs/backlog/codex-handoffs/<story-id>.md` when relevant
   - memory docs when durable truth changed
3. Run `npm run gate:commit`.
4. Inspect the gate output, then inspect any extra packet or tracker changes the gate surfaced.
5. Stage intentionally, preferably with targeted adds or `git add -p`.
6. Run the smallest required validation set for the staged change.

Commit message format:

- Conventional-commit style is preferred.
- Include the story id in the subject.
- Keep the subject short and specific.

Examples:

- `feat(TTB-202): add upload intake normalization`
- `fix(TTB-204): degrade ambiguous warning checks to review`
- `chore(TTB-WF-001): add commit and push gates`

Rules:

- Do not hide unrelated cleanup inside a story commit.
- Do not combine refactor-only edits with new behavior unless the diff is still clearly one change.
- WIP commits are allowed on local branches, but reviewable history should be cleaned before merge when practical.
- Repo-managed `commit-msg` hooks now enforce conventional-commit subjects and require the branch story id in each normal story commit.

## Push gate

Before each push:

1. Run `npm run gate:push`.
2. Refresh remotes with `git fetch --all --prune` when the branch has been open long enough to drift.
3. Rebase or otherwise re-sync from the integration base if needed.
4. Re-run the validation set appropriate to the pushed surface.
5. Push to the story branch, not to `main` or `production`.

Rules:

- First push for a new branch should use `git push -u origin <branch-name>`.
- If history must be rewritten on a shared branch, use `git push --force-with-lease`, never plain `--force`.
- A push that is meant for review should include the packet and tracker state needed to understand the story.
- Claude may push draft UI work before visual approval, but must not mark the backlog handoff `ready-for-codex` until the user approved the direction.
- Codex may push draft engineering work before final acceptance, but reviewable pushes should already have the required RED/GREEN proof and packet updates.

## Publish gate

Before any handoff or reply that claims the branch is available on GitHub:

1. Push the branch to its upstream.
2. Run `npm run gate:publish`.
3. Do not proceed unless the worktree is clean and local `HEAD` exactly matches the upstream branch.

Rules:

- If the branch has never been pushed, publish it with `git push -u origin <branch-name>` before any handoff that references GitHub state.
- If `npm run gate:publish` fails, the branch is not considered handoff-ready, even if local tests pass.
- `ready-for-codex`, QA-style review, and final acceptance handoffs are blocked until the publish gate passes.

## Repo-managed hooks

This repo now installs local git hooks from `.githooks/` through `npm run hooks:install` (triggered by `postinstall`).

Current managed hooks:

- `pre-commit` -> `npm run gate:commit`
- `pre-push` -> `npm run gate:push`
- `commit-msg` -> `npm run gate:commit-msg -- <message-file>`

These hooks do not replace the publish gate. They enforce commit and push checks automatically, while `npm run gate:publish` verifies that the branch is actually on GitHub before handoff.

## PR description gate

When a story branch is opened as a GitHub pull request:

1. Use `.github/pull_request_template.md`.
2. Fill every required section with real content, not placeholders.
3. Keep the PR body synced with the actual diff as the branch changes.
4. In `Tests Added or Updated`, list the exact new or changed test files and what they cover, or explicitly say no test files changed and why.
5. In `Validation`, list the exact commands or checks run and whether they passed.
6. For visible behavior changes, include screenshots or a concrete manual QA script unless there is a real reason not to.

Rules:

- Production-grade PR descriptions are required for reviewable story branches.
- A PR description that omits tests, validation, risk, or follow-up context is not review-ready.
- The `ci` workflow validates PR descriptions on `pull_request` events, so incomplete PR bodies block the same green path that story auto-merge relies on.
- Use `docs/process/PR_DESCRIPTION_STANDARD.md` as the canonical content standard.

## Merge and deploy gate

Reviewable merge gate:

- the branch is story-scoped
- the packet and tracker are current
- required local validation passed
- no stray debug logs, temporary files, or unrelated diffs remain
- any open PR has a complete description that matches the real diff, test coverage, and validation status
- GitHub now allows only rebase merges into `main`; squash merges and merge commits are disabled so story commits stay visible in the mainline history.
- GitHub deletes merged branches automatically after merge.
- GitHub Actions now auto-update clean story PR branches when `main` moves and auto-merge eligible story PRs after green CI. Branches with real conflicts stay open for manual resolution.
- A published, validated, mergeable story branch should be merged promptly. Leaving reviewable work unmerged is a workflow failure unless the user explicitly asks to hold it or a concrete blocker exists.
- Do not apply that rule to `archive/*`, `rewrite/*`, or long-lived environment rails like `production`; those refs exist for backup, maintenance, or deployment control, not for feature-history consolidation.

Deployment branch rules:

- `main` is the staging deploy branch
- `production` is the production deploy branch
- do not push directly to either branch for normal story work
- merge reviewed story branches into `main`
- promote to `production` only through the explicit production-promotion flow

Post-merge cleanup:

1. switch back to `main`
2. fast-forward local `main`
3. delete the merged story branch locally
4. delete the remote story branch when appropriate

## Story-level expectations

### Claude lane

- Draft pushes are fine while the story is still `draft-ui` or `awaiting-visual-review`.
- A reviewable Claude push should include the updated UI packet and, once approved, the Codex handoff.
- Claude should not push a branch as if it were engineering-ready when the UI still needs user approval.

### Codex lane

- A reviewable Codex push should include the engineering packet updates, tests, and any required eval/privacy/performance artifacts.
- If the story changes visible runtime behavior, the push should leave the repo ready for a manual QA-style handoff.
- If the story changes deployable runtime behavior, the push should leave the repo in a state that can safely merge to `main` and ride the staging deploy flow.
