# Technical Plan

## Scope

Keep the repo workflow disciplined but smaller, restore direct branch work as the default, and keep linked worktrees as an optional isolation path.

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

### Source-size waiver baseline

- The repo currently has inherited files over the 500-line cap on `origin/main`.
- `scripts/source-size-baseline.json` freezes those files at their current line counts.
- The guard should pass for unchanged inherited violations, fail when a baseline file grows, and fail for any new oversized file without a baseline entry.

## Testing strategy

- Add focused unit tests for the new worktree-path and base-resolution helpers.
- Add focused unit tests for repo-local env bootstrap, including sibling inventory recovery for Gemini and OpenAI keys.
- Add focused unit tests for the source-size baseline classification logic.
- Run the script-focused tests while iterating.
- Before handoff, run `npm run test`, `npm run typecheck`, and `npm run build`.
