# Technical Plan

## Scope

Add the checked-in workflow layer under `docs/process/` and `.ai/`, then connect it to the canonical repo rules, including the default Claude-direct UI flow and the optional Stitch-assisted alternates.

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

## Risks and fallback

- Risk: overbuilding the harness for a small repo
- Fallback: keep the workflow set to the minimum recommended baseline and avoid extra lanes not justified yet

## Testing strategy

- validation: reference and consistency audit
- commands: existing `npm run test`, `npm run typecheck`, `npm run build`
- docs check: `rg` search for broken or outdated workflow references
