# Technical Plan

## Scope

Keep the repo workflow disciplined but smaller, restore direct branch work as the default, keep linked worktrees as an optional isolation path, and slim the GitHub PR flow so it does not become a second workflow engine.

## Files

- `AGENTS.md`
- `CLAUDE.md`
- `.ai/codex.md`
- `.ai/agents/claude.md`
- `.ai/docs/WORKSPACE_INDEX.md`
- `.ai/workflows/*`
- `.ai/docs/SPEC_CREATION_METHODOLOGY.md`
- `.ai/memory/README.md`
- `docs/process/GIT_HYGIENE.md`
- `docs/process/BRANCH_TRACKER.md`
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- `docs/specs/README.md`
- `docs/specs/PROJECT_STORY_INDEX.md`
- `docs/specs/TTB-WF-003/*`
- `.gitignore`
- `scripts/story-branch.ts`
- `scripts/story-branch-lib.ts`
- `scripts/story-branch-lib.test.ts`
- `scripts/bootstrap-local-env.ts`
- `scripts/bootstrap-local-env.test.ts`
- `scripts/check-source-size.ts`
- `scripts/check-source-size-lib.ts`
- `scripts/check-source-size-lib.test.ts`
- `scripts/source-size-baseline.json`

## Design

### Lean contract

- Keep SSOT, branch tracker, memory bank, TDD, and clean code as the center of gravity.
- Reduce `.ai` to a small set of primary docs and leave older workflow files as compatibility stubs.
- Make specs optional rather than the default implementation path.

### Direct-branch flow with optional worktrees

- `story:branch open` should prefer `origin/main` as the base for new story work when available.
- Default branch flow uses the current clean checkout.
- If `--worktree <path>` is passed, the helper creates a linked worktree at that sibling path, creates the new story branch there, writes the branch tracker row in that new checkout, and bootstraps repo-local `.env` in that new checkout from the local gauntlet env inventory when credentials are available.
- The helper rejects worktree paths inside the repo root so nested `.claude/worktrees/**` cannot become the default again.
- The branch tracker keeps worktree path detail in the `Notes` column instead of expanding the table shape.

### Lean PR and CI flow

- Auto-opened story PRs should be ready by default rather than drafts.
- PR CI should stay lightweight and fast enough to act as a merge backstop: install deps, typecheck, and test.
- Full verification, including build and golden evals, should stay on pushes to `main` and `production`.
- Hidden auto-merge and auto-update workflows should be removed so normal story completion happens through direct push, PR, and merge steps instead of background orchestration.
- Docs should explicitly tell agents not to narrate waiting on checks unless those checks actually block merge or deploy.

### Source-size waiver baseline

- The repo currently has inherited files over the 500-line cap on `origin/main`.
- `scripts/source-size-baseline.json` freezes those files at their current line counts.
- The guard should pass for unchanged inherited violations, fail when a baseline file grows, and fail for any new oversized file without a baseline entry.

### Branch closeout gate

- `scripts/git-story-gate.ts` should accept the current branch in either the active tracker table or the closed-history table.
- This keeps the branch-name and description checks intact while allowing the final tracker-close commit and push to run through normal hooks.

## Testing strategy

- Add focused unit tests for the new worktree-path and base-resolution helpers.
- Add focused unit tests for repo-local env bootstrap, including sibling inventory recovery for Gemini and OpenAI keys.
- Add focused unit tests for the source-size baseline classification logic.
- Add focused unit coverage for finding a closed branch row and accepting it in the git gate path.
- Validate the GitHub workflow change by checking the workflow YAML, PR template, and git/deploy docs stay aligned on the same ready-PR plus light-PR-CI contract.
- Run the script-focused tests while iterating.
- Before handoff, run `npm run test`, `npm run typecheck`, and `npm run build`.
