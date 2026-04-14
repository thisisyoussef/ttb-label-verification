# Technical Plan

## Scope

Add the checked-in workflow layer under `docs/process/` and `.ai/`, then connect it to the canonical repo rules, including the default Claude-direct UI flow, the optional Stitch-assisted alternates, and a mandatory blast-radius pass before Codex implementation.

## Modules and files

- Update `AGENTS.md`
- Update `CLAUDE.md`
- Update `.ai/codex.md`
- Update `.ai/agents/claude.md`
- Update `scripts/git-story-gate.ts`
- Add `scripts/install-git-hooks.ts`
- Add `.githooks/pre-commit`
- Add `.githooks/pre-push`
- Update `package.json`
- Add `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- Add `docs/process/UI_CLAUDE_CHECKLIST.md`
- Add `docs/process/CODEX_CHECKLIST.md`
- Tighten story-start workflow docs so a selected new story always moves onto a fresh branch before packet or code edits
- Tighten Codex lookup and checklist docs so blast-radius mapping is explicit before implementation
- Update `README.md`
- Add `docs/reference/submission-baseline.md`
- Tighten merge-default instructions in `AGENTS.md`, `CLAUDE.md`, `.ai/codex.md`, `.ai/agents/claude.md`, and `docs/process/GIT_HYGIENE.md`
- Update `.ai/docs/WORKSPACE_INDEX.md`
- Update `.ai/docs/SINGLE_SOURCE_OF_TRUTH.md`
- Add `.ai/memory/**`
- Add `.ai/workflows/**`
- Add `.ai/templates/spec/**`
- Add `docs/specs/README.md`
- Add `docs/specs/TTB-WF-001/**`

## Contracts

- No runtime API or UI contract changes
- Workflow contract becomes checked-in and explicit
- Workflow contract requires a blast-radius map before implementation so dependent surfaces get checked intentionally
- Workflow contract requires a fresh story branch whenever a new feature or story begins
- Submission-facing documentation should stay grounded in the current checked-in prototype rather than roadmap-only claims
- Reviewable story branches should merge promptly to `main`, with explicit exceptions only for backup, maintenance, and deployment-control refs

## Risks and fallback

- Risk: overbuilding the harness for a small repo
- Fallback: keep the workflow set to the minimum recommended baseline and avoid extra lanes not justified yet

## Testing strategy

- validation: reference and consistency audit
- commands: existing `npm run test`, `npm run typecheck`, `npm run build`
- docs check: `rg` search for broken or outdated workflow references, including the blast-radius instructions and guided-help examples
