# Codex Harness

This file mirrors the canonical project rules in `AGENTS.md` and turns them into a Codex-first execution loop.

## Startup checklist

1. Read `AGENTS.md`.
2. Read `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
3. Read `docs/specs/FULL_PRODUCT_SPEC.md`.
4. Read `docs/presearch/2026-04-13-foundation.md`.
5. Read `docs/reference/env-audit-2026-04-13.md`.
6. Read `docs/reference/product-docs/README.md`.
7. Read `docs/process/DEPLOYMENT_FLOW.md`.
8. Read `CLAUDE.md`.
9. Read `.ai/docs/WORKSPACE_INDEX.md`.
10. Read `docs/backlog/README.md` and the active `docs/backlog/codex-handoffs/<story-id>.md` when the task starts from an approved UI handoff.
11. Read `docs/design/MASTER_DESIGN.md` when the task starts from an approved UI handoff or must preserve a frozen UI.
12. Read `docs/specs/<story-id>/stitch-screen-brief.md` when the story started from the Stitch-assisted UI flow.
13. Read `docs/rules/README.md`, `docs/rules/RULE_SOURCE_INDEX.md`, and `evals/README.md` for validator, extraction, or critical-path work.
14. Inspect `src/shared/contracts/review.ts` before changing API or contract wiring.

## Documentation sources

Codex should actively reference these docs while working:

- `docs/process/` for current lane state and execution checklists
- `docs/specs/FULL_PRODUCT_SPEC.md` for the full build map and `docs/specs/<story-id>/` for the active universal packet
- `docs/reference/product-docs/` for product and domain source material
- `docs/reference/` for env and integration audit notes
- `docs/process/DEPLOYMENT_FLOW.md` for repo bootstrap, Railway CLI flow, and post-story deploy rules
- `docs/design/MASTER_DESIGN.md` when preserving approved UI
- `docs/specs/<story-id>/stitch-screen-brief.md` when preserving a Stitch-assisted UI direction
- `docs/rules/` for deterministic rule sources and citations
- `evals/` for scenario coverage and recorded runs

## Mandatory routing

Before edits:

1. Run the `agent-preflight` skill and publish the brief.
2. If the user says `continue` or `continue with the next story`, run `.ai/workflows/continue-next-story.md`.
3. Read and follow `docs/process/CODEX_CHECKLIST.md`.
4. Run `.ai/workflows/story-lookup.md`.
5. Run `.ai/workflows/story-sizing.md`.
6. If the active story only has `story-packet.md`, expand it into the standard working docs before implementation.
7. If the story has material UI scope, do not start implementation until the approved UI handoff exists; then run `.ai/workflows/codex-from-ui-handoff.md`.
8. If the task is a `standard` non-UI-first feature, run `.ai/workflows/spec-driven-delivery.md`.
9. If the task changes AI behavior, validators, extraction quality, or evidence payloads, run `.ai/workflows/eval-gate.md`.
10. If the task changes behavior, run `.ai/workflows/tdd-pipeline.md`.
11. Use `.ai/workflows/story-handoff.md` before asking for QA review or closing the story.

## Blocking behavior

Codex must block and redirect instead of improvising outside its lane.

- If the user says `continue` or `continue with the next story`, resolve that request from `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `.ai/workflows/continue-next-story.md`.
- If the task needs frontend design, layout, interaction changes, copy work, or a new Stitch pass, stop and tell the user to continue in Claude.
- If the story has UI scope and the approved Claude handoff does not exist yet, stop and tell the user to finish the Claude lane first.
- If engineering exposes a required UI change, stop, write the issue back to `docs/backlog/codex-handoffs/<story-id>.md`, and tell the user to take that follow-up to Claude.
- If the next ready story in the tracker belongs to Claude instead of Codex, stop and redirect rather than skipping ahead to a later engineering story.
- Redirect messages should be short and explicit:
  - `Blocked in Codex lane`
  - `Next agent: Claude`
  - `Reason: ...`
  - `Use: <exact file paths>`

## Codex ownership

- Server architecture
- OpenAI Responses API integration
- Deterministic validators and evidence models
- Shared contracts, fixtures, and tests
- Evaluation harness, rule-source traceability, privacy gates, and performance proof for the engineering path
- API surfaces that satisfy the approved UI contract without redesigning the frontend

## Non-negotiables

- Use the Responses API, not legacy chat completions, for new model work.
- Set `store: false` on every request.
- Prefer structured outputs for extraction.
- A single extraction pass is the baseline; a second model pass is allowed only for bounded recovery or ambiguity resolution.
- Never let uncertain visual judgments silently harden into `pass`.
- Do not edit `src/client/**`, layout, styling, copy, or interaction flow unless the user explicitly overrides the lane split.
- Every validator-facing rule needs a checked-in source trail. Update `docs/rules/RULE_SOURCE_INDEX.md` and the story packet's `rule-source-map.md` when the rule surface changes.
- Every upload or model story needs explicit no-persistence verification, not just intent.
- Every single-label critical-path story needs measured timing, not just a budget claim.
- Codex owns deployment scaffolding and release automation for this repo.
- Prefer the local `railway` CLI for Railway bootstrap, status, log inspection, and manual spot checks.
- Update the checked-in memory and source-of-truth docs when durable workflow or architecture truth changes.

## Execution loop

1. Start from the approved UI handoff or the active universal story packet, not from unstated assumptions.
2. Use `docs/process/SINGLE_SOURCE_OF_TRUTH.md` as the only checked-in source of active story order and lane readiness.
3. If the story is UI-first, complete `constitution-check.md`, `feature-spec.md`, `technical-plan.md`, and `task-breakdown.md` in `docs/specs/<story-id>/` from the approved handoff before implementation.
4. Add the relevant packet artifacts before coding:
   - `evidence-contract.md` for response/evidence changes
   - `rule-source-map.md` for validator or citation changes
   - `privacy-checklist.md` for uploads, model calls, or ephemeral-data handling
   - `performance-budget.md` for single-label critical-path work
   - `eval-brief.md` for AI or grading changes
5. Add or update a failing test derived from acceptance criteria and, when relevant, from the eval corpus.
6. Change the smallest contract or module that satisfies the test.
7. Refactor only after GREEN is established.
8. If engineering exposes a UI gap, record it back in `docs/backlog/codex-handoffs/<story-id>.md` instead of redesigning the frontend.
9. Run the relevant eval slice, privacy checks, and measured timing before final handoff.
10. Verify the result with `npm run test`, `npm run typecheck`, and `npm run build`.
11. For deployable implementation stories, follow `docs/process/DEPLOYMENT_FLOW.md` and report staging-deploy status or the exact CI/Railway blocker.
12. Update the presearch, spec packet, rule index, eval result, backlog item, deploy note, or memory docs when durable truth changes.

## Boundaries with Claude

- Claude owns `src/client/**`, UI composition, and interaction polish.
- Codex treats Claude's approved UI as fixed and works behind the contract, not through frontend redesign.
