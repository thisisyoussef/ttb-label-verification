# Codex Harness

This file mirrors the canonical project rules in `AGENTS.md` and turns them into a Codex-first execution loop.

## Startup checklist

1. Read `AGENTS.md`.
2. Read `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
3. Read `docs/specs/FULL_PRODUCT_SPEC.md`.
4. Read `docs/presearch/2026-04-13-foundation.md`.
5. Read `docs/reference/env-audit-2026-04-13.md`.
6. Read `docs/process/TRACE_DRIVEN_DEVELOPMENT.md` when the task touches prompt/model/tool-call or agentic LLM behavior.
7. Read `docs/process/TEST_QUALITY_STANDARD.md`.
8. Read `docs/process/STITCH_AUTOMATION.md` when the task touches the Stitch harness or starts from a Stitch-assisted UI flow.
9. Read `docs/process/GIT_HYGIENE.md`.
10. Read `docs/reference/product-docs/README.md`.
11. Read `docs/process/DEPLOYMENT_FLOW.md`.
12. Read `CLAUDE.md`.
13. Read `.ai/docs/WORKSPACE_INDEX.md`.
14. Read `docs/backlog/README.md` and the active `docs/backlog/codex-handoffs/<story-id>.md` when the task starts from an approved UI handoff.
15. Read `docs/design/MASTER_DESIGN.md` when the task starts from an approved UI handoff or extends an established UI.
16. Read `docs/specs/<story-id>/stitch-screen-brief.md` when the story started from the Stitch-assisted UI flow.
17. Read `docs/rules/README.md`, `docs/rules/RULE_SOURCE_INDEX.md`, and `evals/README.md` for validator, extraction, or critical-path work.
18. Inspect `src/shared/contracts/review.ts` before changing API or contract wiring.

## Documentation sources

Codex should actively reference these docs while working:

- `docs/process/` for current lane state and execution checklists
- `docs/specs/FULL_PRODUCT_SPEC.md` for the full build map and `docs/specs/<story-id>/` for the active universal packet
- `docs/reference/product-docs/` for product and domain source material
- `docs/reference/` for env and integration audit notes
- `docs/process/TRACE_DRIVEN_DEVELOPMENT.md` for LangSmith-backed prompt/model/tool-call tuning
- `docs/process/TEST_QUALITY_STANDARD.md` for repo-level test design rules, contract coverage, property tests, and mutation checks
- `docs/process/STITCH_AUTOMATION.md` for the Claude-direct default UI flow and Stitch alternate-mode rules
- `docs/process/GIT_HYGIENE.md` for branch, commit, push, and merge gates
- `docs/process/DEPLOYMENT_FLOW.md` for repo bootstrap, Railway CLI flow, and post-story deploy rules
- `docs/design/MASTER_DESIGN.md` when preserving approved UI
- `docs/specs/<story-id>/stitch-screen-brief.md` when preserving a Stitch-assisted UI direction
- `docs/rules/` for deterministic rule sources and citations
- `evals/` for scenario coverage and recorded runs

## Mandatory routing

Before edits:

1. Run the `agent-preflight` skill and publish the brief.
2. If the user says `continue` or `continue with the next story`, run `.ai/workflows/continue-next-story.md`.
3. Before starting a non-foundation blocking story, confirm there is no earlier workflow, eval, or other foundation story still marked `ready` or `in progress`.
4. After earlier workflow/eval foundations are clear, treat approved UI handoffs marked `ready-for-codex` as the preferred `continue` target before later blocking `TTB-2xx+` engineering work. If no ready handoff remains, use the tracker's `Next blocking for Codex` pointer.
5. Read and follow `docs/process/CODEX_CHECKLIST.md`.
6. Run `.ai/workflows/story-lookup.md`.
7. Run `.ai/workflows/story-sizing.md`.
8. If the current branch does not already belong to the selected story, create or switch to a fresh `codex/<story-id>-<summary>` or `chore/<story-id>-<summary>` branch before packet or code edits. Do this even when the current branch is another valid story branch.
9. If the active story only has `story-packet.md`, expand it into the standard working docs before implementation.
10. If the story has material UI scope, do not start implementation until the approved UI handoff exists; then run `.ai/workflows/codex-from-ui-handoff.md`.
11. If the task is a `standard` non-UI-first feature, run `.ai/workflows/spec-driven-delivery.md`.
12. If the task changes AI behavior, validators, extraction quality, or evidence payloads, run `.ai/workflows/eval-gate.md`.
13. If the task changes prompt/model/tool-call or agentic LLM behavior, run `.ai/workflows/trace-driven-development.md`.
14. If the task changes behavior, run `.ai/workflows/tdd-pipeline.md`.
15. Use `.ai/workflows/story-handoff.md` before asking for QA review or closing the story.
16. Before declaring missing local OpenAI runtime config, run `npm run env:bootstrap`.

## Blocking behavior

Codex must block and redirect instead of improvising outside its lane.

- If the user says `continue` or `continue with the next story`, resolve that request from `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `.ai/workflows/continue-next-story.md`.
- If the task needs a net-new frontend direction, major redesign, broad copy/interaction exploration, or a new Stitch pass, stop and tell the user to continue in Claude.
- If the story has UI scope and the approved Claude handoff does not exist yet, stop and tell the user to finish the Claude lane first.
- If engineering exposes a story-scoped UI change, make it directly and record the durable outcome in the packet/handoff. If it exposes a broader redesign or new UI direction, stop, write the issue back to `docs/backlog/codex-handoffs/<story-id>.md`, and tell the user to take that follow-up to Claude.
- If the tracker exposes a Codex-ready parallel-safe story or an approved UI handoff that SSOT marks executable non-blocking, Codex may take it even while Claude owns a different active UI story. If the tracker exposes no Codex-ready story, stop and redirect instead of inventing one.
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
- API surfaces and client behavior that satisfy the approved UI contract and may refine it as needed to finish the story well

## Non-negotiables

- Use the Responses API, not legacy chat completions, for new model work.
- Set `store: false` on every request.
- Prefer structured outputs for extraction.
- A single extraction pass is the baseline; a second model pass is allowed only for bounded recovery or ambiguity resolution.
- Never let uncertain visual judgments silently harden into `pass`.
- Keep LangSmith tracing off by default and enable it only for explicit local trace runs on approved fixtures or sanitized inputs.
- You may edit `src/client/**` after an initial Claude-created slice or `ready-for-codex` handoff exists. Those edits may include integration wiring plus story-scoped copy, layout, styling, interaction, and component-structure refinements, as long as they stay aligned with `docs/design/MASTER_DESIGN.md`, the story packet, and the handoff's hard constraints.
- Codex may verify Stitch tooling or inspect already-approved Stitch references, but may not use Stitch to generate or redesign UI from the Codex lane.
- Every validator-facing rule needs a checked-in source trail. Update `docs/rules/RULE_SOURCE_INDEX.md` and the story packet's `rule-source-map.md` when the rule surface changes.
- Every upload or model story needs explicit no-persistence verification, not just intent.
- Every single-label critical-path story needs measured timing, not just a budget claim.
- Keep the suite pyramid-shaped and hermetic. Do not compensate for weak tests with more fragile end-to-end coverage.
- If you touch `src/client/**` from the Codex lane, preserve the UI hygiene rules from `CLAUDE.md` and `AGENTS.md`: keep files under the 300-line soft cap and 500-line hard stop, avoid barrel files and deep nesting, and do not collapse multiple concerns into one component just because the change is "small".
- Do not treat a planned change as local until you map its blast radius. Search for dependent routes, shared contracts, fixtures, evals, packet docs, handoff docs, and adjacent user flows before implementation.
- If a story touches client shell, navigation, results, view-state, or target-anchor surfaces, inspect the guided-help dependents as part of that blast-radius pass: `src/shared/contracts/help.ts`, `src/shared/help-fixture.ts`, `src/server/help-routes.test.ts`, `src/client/help-runtime.ts`, `src/client/helpManifest.ts`, `src/client/tourTargets.ts`, `src/client/helpReplayState.ts`, `src/client/GuidedTourSpotlight.tsx`, and any affected `data-tour-target` anchors.
- If a story branch is opened as a PR, keep the description production-grade and synced with the diff. Use `.github/pull_request_template.md` and explicitly list changed surfaces, tests added or updated, validation run, risks, screenshots or manual QA, and follow-ups.
- When a story branch reaches GitHub, keep it on the GitHub PR path end to end: push the branch, let GitHub open or host the PR, keep the PR body current, and merge through the PR. Do not update `main` or `production` with direct ref pushes such as `<branch>:main`. Use the authenticated `gh` CLI explicitly for PR inspection, body edits, readiness changes, checks, and merges.
- Treat `evals/golden/manifest.json` as the canonical golden set and `evals/labels/manifest.json` as the live image-backed core-six subset. Missing binaries under `evals/labels/assets/` are only live-run blockers, not generic implementation blockers.
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
   - `trace-brief.md` for prompt/model/tool-call or agentic LLM tuning work
5. Build a blast-radius map before coding. Search the repo for the files, symbols, routes, selectors, state transitions, fixtures, and docs you expect to touch; identify the direct and indirect dependents.
6. If the change touches client shell or flow surfaces, inspect dependent guided-help surfaces before implementation: help manifest or fixture sources, help runtime, replay state, guided-tour runtime, help route tests, and the affected `data-tour-target` anchors.
7. Add or update a failing test derived from acceptance criteria and, when relevant, from the eval corpus.
8. Choose the smallest viable test layer, add contract tests for boundary changes, and add property tests for broad-input pure logic where examples alone are weak.
9. For high-risk pure logic such as validators, severity mapping, or comparison helpers, run a targeted mutation pass before closeout or record an explicit waiver.
10. Change the smallest contract or module that satisfies the test.
11. Refactor only after GREEN is established.
12. If engineering exposes a broader UI-direction gap, record it back in `docs/backlog/codex-handoffs/<story-id>.md` instead of improvising a redesign. If the change is story-scoped and aligned, make it and document it.
13. Verify at least one adjacent dependent flow when the blast radius includes downstream consumers; if a related surface is intentionally unaffected, record why in the packet or handoff.
14. Run the relevant eval slice, trace loop, privacy checks, and measured timing before final handoff.
15. Verify the result with `npm run test`, `npm run typecheck`, and `npm run build`.
16. Run `npm run gate:commit` before a reviewable commit, `npm run gate:push` before a reviewable push, and `npm run gate:publish` before any handoff or reply that claims the branch is on GitHub.
17. If a PR exists for the branch, update the PR description so it truthfully reflects the final diff, test coverage, validation status, and remaining risks before handoff.
18. Merge reviewable story branches through their GitHub PRs instead of direct ref pushes to `main` or `production`, using the authenticated `gh` CLI for the GitHub-side actions when it is available.
19. If the branch is published, validated, and mergeable, merge it into `main` before calling the work complete unless the user explicitly asks to hold it or a concrete blocker exists.
20. If the story changed visible or repeatable runtime behavior, start the local app/server and hand the exact URL plus a concrete manual test script to the user.
21. Do not use Playwright or other browser automation as the final acceptance gate for visible Codex stories.
22. For deployable implementation stories, follow `docs/process/DEPLOYMENT_FLOW.md` and report staging-deploy status or the exact CI/Railway blocker.
23. Update the presearch, spec packet, rule index, eval result, backlog item, deploy note, or memory docs when durable truth changes.

When touching `src/client/**` during engineering:

- keep the existing component and hook boundaries clean
- extract before crossing the UI file-size limits
- do not add business rules, validator logic, or transport normalization into components
- prefer a tiny wiring adapter over inflating a presentational component into a mixed-responsibility file

## Boundaries with Claude

- Claude owns the initial frontend design direction in `src/client/**`, UI composition, and the first pass at interaction polish.
- Codex starts from Claude's approved UI and may refine it while finishing the working product, as long as those refinements stay within story intent, the design system, and the handoff's hard constraints.
- Codex is the lane that waits first: it begins after the required Claude handoff exists and earlier Codex prerequisites are satisfied.
- Codex waits only on the specific UI-gated story it is trying to execute. Codex-only stories and approved UI handoffs that the tracker marks executable parallel-safe may proceed while Claude continues a different UI story.
