# Single Source of Truth

Last updated: 2026-04-18 (`TTB-WF-003` is complete after removing the old lane split, making direct branch work the default, adding automatic repo-local env bootstrap for new linked worktrees, keeping routine env sync out of normal progress chatter, letting a branch close its own tracker row through local gates, opening story PRs as ready by default, and slimming PR CI so agents merge directly instead of narrating a draft-to-ready wait loop. `TTB-EVAL-002` is complete with an opt-in inline Gemini Batch runner plus dry-run proof over the approved 35-case live corpus. `TTB-304` is complete with dual-image intake carried through single review, batch matching, toolbench samples, and result galleries. `TTB-210` still needs traced LangSmith evidence because the current auth path fails with `401 /datasets` in the tracked eval flow and `403` on direct trace upload, but its local guardrails now keep non-label or no-text auto-detect extractions at `unknown` unless trustworthy alcohol-label evidence is present. `TTB-401` remains blocked on `TTB-210`.)

## Continue resolution

- When the user says `continue`, `continue the story`, or `continue with the next story`, read this file first.
- If there is already an in-progress active story, continue it.
- If the current branch already contains finished but unpublished or unmerged work, finish the git flow first unless the user explicitly says to hold it.
- Earlier workflow and eval foundation stories still gate later feature pickup.
- Otherwise, use the `Next preferred story` pointer below.
- If the next step belongs to the user, stop and ask for that exact action instead of guessing.
- Never infer story order from chat memory when this file disagrees.

## Workflow strategy

- `docs/specs/FULL_PRODUCT_SPEC.md` is the product-wide blueprint.
- `docs/specs/PROJECT_STORY_INDEX.md` is the ordered leaf-story queue.
- `docs/specs/<story-id>/` is the universal story packet for that story.
- `docs/process/BRANCH_TRACKER.md` is the branch-lifecycle source of truth; keep story queue state here and branch inventory there.
- Existing `TTB-001` through `TTB-004` folders remain umbrella packets for the major product areas.
- New `TTB-1xx`, `TTB-2xx`, `TTB-3xx`, and `TTB-4xx` stories are the executable leaf queue.
- A planning-stage leaf story may start as `story-packet.md`; any agent may create or expand that packet before implementation when deeper working docs are needed.
- Older UI-first handoffs and lane-marked packets remain useful context for past stories, but they are not standing blockers for new work.
- Either agent may execute any story directly on a fresh story branch.
- Stitch is optional per story. The default mode is `direct`; `automated` and `manual` are explicit alternates.

## Current project state

- Project status: runnable scaffold plus full-product planning set with live GitHub and Railway backing.
- Runtime status: React + Express scaffold exists, the shared review contract includes typed extraction plus warning evidence, `POST /api/review` keeps uploads in memory and runs the integrated extraction plus warning plus aggregation path, `POST /api/review/seed` remains the scaffold-only inspection route, `POST /api/review/extraction` runs the live extraction boundary, `POST /api/review/warning` stages the warning validator, and contracts are tested.
- Process status: TDD gate, LangSmith-backed trace-driven development, direct branch workflow, automatic repo-local env bootstrap for new linked worktrees, ready-by-default story PRs, lightweight PR CI, deployment flow, repo-managed git hooks, and publish gates are checked in.
- Planning status: `TTB-WF-003`, `TTB-106`, `TTB-107`, `TTB-108`, `TTB-206`, `TTB-207`, `TTB-208`, `TTB-209`, `TTB-211`, `TTB-302`, and `TTB-303` are complete. `TTB-212` was archived by user request.
- Planning status: `TTB-WF-003`, `TTB-EVAL-002`, `TTB-304`, `TTB-106`, `TTB-107`, `TTB-108`, `TTB-206`, `TTB-207`, `TTB-208`, `TTB-209`, `TTB-211`, `TTB-302`, and `TTB-303` are complete. `TTB-212` was archived by user request.
- GitHub bootstrap status: live repo exists at `thisisyoussef/ttb-label-verification`.
- Railway bootstrap status: project, service, staging, production, public domains, and GitHub Actions token wiring are configured.

## Active pointers

- Active story: `TTB-210`
- Next preferred story: `TTB-210`
- Next blocking story: `TTB-210`, then `TTB-401`
- Current blocker owner: none
- Current manual user action: none

## Open story snapshot

| Order | Story ID | Parent | Title | Status | Next action | Blocking gate |
| --- | --- | --- | --- | --- | --- | --- |
| 21 | `TTB-210` | `TTB-002` | persona-centered prompt profiles and endpoint plus mode guardrails | `in-progress` | publish the remaining traced evidence after refreshing LangSmith auth; local code, tests, build, and fixture evals are already green | LangSmith auth currently fails with `401 /datasets` in the tracked eval flow and `403` on direct trace upload |
| 23 | `TTB-401` | `TTB-004` | final privacy, performance, eval, and submission pack | `blocked-by-dependency` | run the release gate and package the submission | `TTB-210` complete |

Completed leaf stories through `TTB-WF-003`, `TTB-EVAL-002`, `TTB-209`, `TTB-211`, `TTB-302`, `TTB-303`, and `TTB-304` are the current baseline.

## Review and handoff points

- Hand off to the user for Stitch review only when the current pass is using automated or manual Stitch.
- Hand off to the user for visual review when the story explicitly needs design approval before the work can proceed.
- Hand off to QA-style review or final acceptance after implementation, tests, evals, privacy checks, timing proof, and the required end-to-end API-plus-Comet browser verification are complete.
- Mergeable story work should normally be pushed and merged before final acceptance handoff, not left sitting as a local-only branch.
- After deployable stories, report staging deployment status or the exact CI or Railway deploy failure.

## Update rules

- This file is the checked-in tracker for active story, queue status, blockers, and next-step resolution.
- Branch inventory, branch description, and PR lifecycle metadata live in `docs/process/BRANCH_TRACKER.md`, not here.
- The checklist docs are procedural references. Do not use them as status trackers.
- Update this file when the active story changes, a blocker changes, the next preferred story changes, or a manual user prerequisite appears or clears.
- Story packet shape and creation methodology live in `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.
