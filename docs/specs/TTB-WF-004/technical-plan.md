# Technical Plan

## Scope

Make automatic production promotion the default checked-in deploy path by keeping staging and production rollout inside one trustworthy automation chain, while preserving a manual rollback or backfill workflow for validated refs.

## Files

- `.github/workflows/railway-post-deploy.yml`
- `.github/workflows/promote-production.yml`
- `docs/process/DEPLOYMENT_FLOW.md`
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- `docs/specs/FULL_PRODUCT_SPEC.md`
- `docs/specs/PROJECT_STORY_INDEX.md`
- `docs/specs/TTB-WF-004/*`
- `.ai/memory/project/architecture.md`
- `.ai/memory/project/patterns.md`
- `.ai/memory/project/anti-patterns.md`
- `.ai/memory/project/technical-debt.md`
- `.ai/memory/session/active-context.md`
- `.ai/memory/session/decisions-today.md`
- `.ai/memory/session/blockers.md`

## Design

### Automatic path

- Keep the existing trigger surface: successful `workflow_run` completion of `ci` for `main`.
- Leave staging deploy first.
- After staging deploy plus healthcheck pass, run the production Railway deploy in the same workflow using the same `head_sha`.
- Only after production healthcheck passes, sync the `production` branch to that SHA as bookkeeping.
- This avoids depending on a second workflow run created from a workflow-authenticated branch update.

### Manual path

- Keep `promote-production.yml` as the manual rollback or backfill entry point.
- Stop dispatching `ci` and waiting for another workflow to continue the release.
- Instead, fetch the requested `source_ref`, deploy that exact SHA directly to Railway production, verify `/api/health`, then sync the `production` branch after success.
- Document that the manual path is only for already-validated refs.

### Docs

- Update deployment docs to describe `main -> ci -> staging deploy -> production deploy -> production branch sync` as the default path.
- Reframe the manual promotion workflow as rollback or validated-ref backfill, not the routine release mechanism.
- Add the new workflow story to the story index and mark it active in SSOT.

## Contracts

- No runtime API or UI contract changes
- Release automation contract changes so the production deploy no longer depends on a downstream workflow handoff after a `GITHUB_TOKEN` branch push
- `production` branch becomes the recorded live-production SHA after successful production verification, rather than the trigger that production depends on

## Risks and fallback

- Risk: branch bookkeeping could diverge from live production if branch sync happens before production verification
  - Mitigation: sync `production` only after production healthcheck success
- Risk: the manual workflow could become too permissive and bypass validation discipline
  - Mitigation: document it as rollback/backfill for a validated ref only; keep automatic path as the normal route
- Risk: future maintainers may assume the old `production` workflow-run chain still drives production
  - Mitigation: update the checked-in deploy docs and product blueprint together with the workflow YAML

## Testing strategy

- Validation: inspect workflow YAML for the new main-path sequencing and manual-path direct deploy behavior
- Commands: `npm run test`, `npm run typecheck`, `npm run build`
- Live harness check: verify that the workflow files and docs agree on the same automatic promotion model
