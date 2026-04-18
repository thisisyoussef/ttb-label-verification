# Task Breakdown

1. Simplify the core agent contract docs.
   - Validation: `AGENTS.md`, `CLAUDE.md`, `.ai/codex.md`, `.ai/agents/claude.md`, and `.ai/docs/WORKSPACE_INDEX.md` reflect the lean read set and direct-branch default.

2. Reduce `.ai` workflow sprawl.
   - Validation: the primary `.ai` workflow files are `continue-next-story.md`, `story-lookup.md`, `story-sizing.md`, and `tdd-pipeline.md`; the rest are compatibility stubs.

3. Keep worktree-aware branch helper behavior as an option, not the default.
   - Validation: `scripts/story-branch.ts` supports `--worktree`, prefers `origin/main`, rejects nested worktree paths, and bootstraps repo-local env in new linked worktrees; focused tests pass.

4. Stop tracking nested `.claude/worktrees`.
   - Validation: `.gitignore` ignores `.claude/worktrees/`, and the git index no longer tracks those nested worktree entries.

5. Add a checked-in baseline waiver for inherited source-size violations.
   - Validation: `scripts/check-source-size.ts` blocks new oversized files and baseline regressions while allowing unchanged inherited oversize files from `scripts/source-size-baseline.json`.

6. Update the checked-in trackers and memory.
   - Validation: SSOT, branch tracker, packet docs, and memory files reflect the new durable workflow truth.
