# Feature Spec

## Story

- Story ID: `TTB-WF-003`
- Title: lean agent workspace and direct-branch story workflow

## Problem statement

The repo currently repeats workflow rules across too many files and still carries a spec-heavy delivery habit that slows simple tasks down. It also has linked-worktree support, but nested `.claude/worktrees` paths were tracked by git, which dirties normal checkouts and confuses parallel work.

## Outcomes

- Agents read a much smaller core contract.
- SSOT and memory bank remain the durable coordination layer.
- Starting a new task defaults to working directly on a fresh story branch.
- The branch helper can still create and track an optional sibling worktree when isolation is needed.
- Nested `.claude/worktrees` stop being a tracked repo surface.

## Acceptance criteria

1. `AGENTS.md`, `CLAUDE.md`, `.ai/codex.md`, `.ai/agents/claude.md`, and `.ai/docs/WORKSPACE_INDEX.md` are materially simpler and focus on SSOT, memory, TDD, clean code, and branch hygiene.
2. The active `.ai` workflow set is reduced to the core loop: continue, lookup, sizing, and TDD.
3. Specs are no longer the default path for normal implementation work; they are optional when the task warrants them.
4. `npm run story:branch -- open ... --worktree <path>` still creates a sibling linked worktree on a new story branch and updates the tracker in that new checkout.
5. The helper refuses linked worktree paths inside the repo root.
6. The default base for fresh story work prefers current `origin/main` when available.
7. `.gitignore` blocks `.claude/worktrees/`, and tracked nested worktree entries are removed from git.
8. Git hygiene docs explicitly recommend direct branch work by default, with sibling worktrees reserved for parallel or dirty-checkout isolation.
9. The source-size gate uses a checked-in baseline waiver for inherited oversized files so unrelated workflow branches can still commit while blocking new oversized files and growth beyond the baseline.
10. SSOT, branch tracker, story packet, and memory reflect the new workflow truth.

## Out of scope

- Runtime product behavior
- Validators, extractors, or API contracts
- Deployment topology changes
