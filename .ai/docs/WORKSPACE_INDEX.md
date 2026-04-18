# Workspace Index

Core docs:

- `AGENTS.md` — canonical repo contract
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` — active story and next-step tracker
- `docs/process/GIT_HYGIENE.md` — branch, worktree, push, and merge rules
- `docs/process/BRANCH_TRACKER.md` — branch lifecycle registry
- `CLAUDE.md` — agent mirror for Claude
- `docs/process/CODEX_CHECKLIST.md` — implementation checklist used for engineering or mixed-surface story work
- `docs/specs/FULL_PRODUCT_SPEC.md` — product blueprint
- `docs/specs/PROJECT_STORY_INDEX.md` — story queue

Core helpers:

- `scripts/git-hooks/story-branch.ts` — open, update, and close story branches; can optionally create linked worktrees
- `scripts/git-hooks/branch-tracker.ts` — tracker helpers
- `scripts/git-hooks/git-story-gate.ts` — commit, push, and publish gates

Core workflows:

- `.ai/workflows/continue-next-story.md`
- `.ai/workflows/story-lookup.md`
- `.ai/workflows/story-sizing.md`
- `.ai/workflows/tdd-pipeline.md`

Memory:

- `.ai/memory/README.md`
- `.ai/memory/project/**`
- `.ai/memory/session/**`

Legacy `.ai` workflow files that still exist are compatibility stubs, not the primary contract.
