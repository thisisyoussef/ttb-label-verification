# Workspace Index

Core docs:

- `AGENTS.md` — canonical repo contract
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` — active story and next-step tracker
- `docs/process/GIT_HYGIENE.md` — branch, worktree, push, and merge rules
- `docs/process/BRANCH_TRACKER.md` — branch lifecycle registry
- `CLAUDE.md` — Claude lane contract
- `docs/specs/FULL_PRODUCT_SPEC.md` — product blueprint
- `docs/specs/PROJECT_STORY_INDEX.md` — story queue

Core helpers:

- `scripts/story-branch.ts` — open, update, and close story branches; can optionally create linked worktrees
- `scripts/branch-tracker.ts` — tracker helpers
- `scripts/git-story-gate.ts` — commit, push, and publish gates

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
