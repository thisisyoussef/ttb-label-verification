# Task Breakdown

## Task 1

- Objective: add the source-of-truth and memory-bank structure
- Dependency: `must-have`
- Validation: files exist and are linked from the workspace index

## Task 2

- Objective: add lookup, sizing, spec, and TDD workflow docs plus spec templates
- Dependency: `must-have`
- Validation: workflow and template files exist and are referenced from `AGENTS.md`

## Task 3

- Objective: update canonical repo instructions and agent mirrors to enforce the new workflow
- Dependency: `must-have`
- Validation: `AGENTS.md`, `.ai/codex.md`, and `.ai/agents/claude.md` all reference the same workflow order

## Task 4

- Objective: create a checked-in packet for `TTB-WF-001` so the workflow is dogfooded
- Dependency: `parallel`
- Validation: `docs/specs/TTB-WF-001/` contains the four core artifacts

## Task 5

- Objective: enforce local commit/push hooks and add a publish gate for GitHub-facing handoffs
- Dependency: `must-have`
- Validation: `.githooks/` exists, `package.json` exposes the install/publish commands, and the workflow docs treat unpublished branches as blocked

## Task 6

- Objective: keep evaluator-facing delivery docs checked in by upgrading the top-level README and maintaining a submission baseline for deliverables, tools, assumptions, and evaluation criteria
- Dependency: `parallel`
- Validation: `README.md` and `docs/reference/submission-baseline.md` match the current checked-in build and verified deployed review URL

## Task 7

- Objective: treat unmerged-but-reviewable branches as a workflow failure by updating the agent contracts and merge-gate docs
- Dependency: `parallel`
- Validation: `AGENTS.md`, `CLAUDE.md`, `.ai/codex.md`, `.ai/agents/claude.md`, and `docs/process/GIT_HYGIENE.md` all describe the same merge-default rule and the same `archive/*` / `rewrite/*` / `production` exceptions

## Task 8

- Objective: require Codex to map blast radius and dependent flows before implementation, with explicit guided-help examples for client-shell changes
- Dependency: `parallel`
- Validation: `AGENTS.md`, `.ai/codex.md`, `.ai/workflows/story-lookup.md`, and `docs/process/CODEX_CHECKLIST.md` all require the same blast-radius pass and name the same guided-help dependent surfaces

## Task 9

- Objective: require every new story or feature to start on a fresh branch instead of reusing the previous story branch
- Dependency: `parallel`
- Validation: `AGENTS.md`, `CLAUDE.md`, `.ai/codex.md`, `.ai/agents/claude.md`, `.ai/workflows/continue-next-story.md`, `.ai/workflows/story-lookup.md`, `docs/process/GIT_HYGIENE.md`, `docs/process/UI_CLAUDE_CHECKLIST.md`, and `docs/process/CODEX_CHECKLIST.md` all require a fresh branch when the selected story changes
