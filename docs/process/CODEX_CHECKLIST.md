# Codex Engineering Checklist

Use this checklist whenever Codex is the active lane owner for a story.

## Start gate

- [ ] If the user said `continue` or `continue with the next story`, resolve the current story through `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `.ai/workflows/continue-next-story.md`.
- [ ] Confirm no earlier workflow or eval foundation story is still `ready` or `in progress` before starting a later feature story.
- [ ] Confirm `docs/process/SINGLE_SOURCE_OF_TRUTH.md` either names this story as `Next blocking for Codex`, lists it as the active Codex story, or explicitly marks it `ready-parallel` for Codex.
- [ ] For any story with material UI scope, confirm `docs/backlog/codex-handoffs/<story-id>.md` exists and is marked `ready-for-codex`.
- [ ] If the story is an approved `TTB-1xx` handoff marked `ready-parallel`, confirm it is the preferred Codex pick ahead of later blocking `TTB-2xx+` work under the tracker rules.
- [ ] Confirm the task belongs to the engineering lane, not a net-new frontend direction or broad redesign.
- [ ] Before packet or code edits, confirm the current branch is story-scoped. If the worktree is on `main` or `production`, switch immediately to `codex/<story-id>-<summary>`.
- [ ] If the story only has `story-packet.md`, expand it into the standard working docs before implementation begins.
- [ ] Before declaring missing local model credentials, run `npm run env:bootstrap`.
- [ ] If the story changes prompt/model/tool-call or agentic LLM behavior, run `npm run langsmith:smoke` before starting the trace loop.
- [ ] If the task needs a new UI direction, major visual exploration, or the approved UI handoff is missing, stop and redirect the user to Claude.
- [ ] If another story is still active in Claude, confirm this story is explicitly safe to run in parallel and does not depend on pending UI approval.

## Read set

- [ ] `AGENTS.md`
- [ ] `.ai/codex.md`
- [ ] `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- [ ] `docs/process/TEST_QUALITY_STANDARD.md`
- [ ] `docs/process/TRACE_DRIVEN_DEVELOPMENT.md` when the story changes prompt/model/tool-call or agentic LLM behavior
- [ ] `docs/process/STITCH_AUTOMATION.md` when the story came through Stitch or the task touches the Stitch harness
- [ ] `docs/process/DEPLOYMENT_FLOW.md`
- [ ] `docs/process/GIT_HYGIENE.md`
- [ ] `docs/specs/FULL_PRODUCT_SPEC.md`
- [ ] `docs/specs/PROJECT_STORY_INDEX.md`
- [ ] `docs/presearch/2026-04-13-foundation.md`
- [ ] `docs/reference/product-docs/README.md`
- [ ] `CLAUDE.md`
- [ ] `.ai/docs/WORKSPACE_INDEX.md`
- [ ] `docs/specs/<story-id>/` packet
- [ ] `docs/specs/<story-id>/stitch-screen-brief.md` when Stitch was used
- [ ] `docs/backlog/codex-handoffs/<story-id>.md` when the story starts from approved UI
- [ ] `docs/design/MASTER_DESIGN.md` when extending an established UI or honoring handoff constraints
- [ ] `docs/rules/README.md`, `docs/rules/RULE_SOURCE_INDEX.md`, and `evals/README.md` for validator or AI behavior work
- [ ] `src/shared/contracts/review.ts`

## Packet and implementation setup

- [ ] Treat `docs/specs/<story-id>/` as the universal story packet and complete the engineering parts there rather than creating a separate backend-only spec.
- [ ] Treat `story-packet.md` as a compact planning artifact only; materialize the deeper docs before real engineering starts.
- [ ] Complete any missing packet docs required by `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.
- [ ] Translate the accepted behavior into contract, validator, privacy, performance, and eval requirements before coding.
- [ ] Add `trace-brief.md` when prompt/model/tool-call or agentic LLM behavior needs trace-driven tuning.
- [ ] Derive tests directly from acceptance criteria and relevant eval scenarios.
- [ ] Decide the smallest viable test layer for each acceptance criterion before writing tests.
- [ ] Force a real RED state before implementation.
- [ ] When a seed adapter, staging route, or story-local bridge powers approved UI, add a RED test that uses non-default submitted values and proves those values survive into the returned contract.
- [ ] Add boundary/contract tests when route payloads, provider payloads, or shared contracts change.
- [ ] Add property tests when changing normalizers, comparators, parsers, tolerance logic, or other broad-input pure helpers.
- [ ] Note any high-risk pure modules that should get a targeted mutation check before handoff.

## Engineering work

- [ ] Implement the minimum server, shared-contract, validator, orchestration, and tooling changes needed to satisfy the packet.
- [ ] Start from the established UI direction, not from scratch. You may update `src/client/**` for integration, correctness, usability, and maintainability work, including copy, layout, styling, and interaction refinements, as long as the result stays aligned with the story packet, `docs/design/MASTER_DESIGN.md`, and the handoff's hard constraints.
- [ ] Use Stitch tooling only for harness work, read-only inspection, or preserving already-approved references. Do not use it to generate a new UI direction from the Codex lane.
- [ ] If you make a material UI refinement from the Codex lane, update the relevant packet and handoff docs so the new durable baseline is recorded.
- [ ] If engineering exposes a broader UI-direction gap, write it back to `docs/backlog/codex-handoffs/<story-id>.md` and hand it back instead of improvising a redesign.
- [ ] When a new screen concept, broad redesign question, or fresh Stitch pass blocks engineering, stop and tell the user explicitly to switch to Claude with the relevant packet and backlog handoff files.
- [ ] Keep no-persistence guarantees explicit for uploads, model calls, temp files, caches, and logs.
- [ ] Keep LangSmith tracing disabled outside explicit trace runs, and never trace staging or production user submissions.
- [ ] Keep low-confidence or ambiguous outcomes reversible and biased toward `review`.

## Verification gate

- [ ] Run the relevant eval slice and record the result in `evals/results/` when AI or validator behavior changes.
- [ ] For prompt/model/tool-call or agentic LLM stories, complete the LangSmith trace loop, inspect traces and runs, and record the winning trace ids or exports in the packet and `evals/results/`.
- [ ] If `evals/golden/manifest.json` or `evals/labels/manifest.json` changed, run `npm run evals:validate`.
- [ ] Only treat missing binaries under `evals/labels/assets/` as a blocker when this story actually requires a live extraction or live eval run; when blocked, list the exact missing asset paths.
- [ ] Verify `privacy-checklist.md` items when uploads, model calls, or ephemeral data handling are involved.
- [ ] Capture measured timings when the story touches the single-label critical path.
- [ ] If the story changed high-risk pure logic such as validators, comparison helpers, or severity mapping, run a targeted mutation pass with `npm run test:mutation -- --mutate "<path>"` or explicitly record why mutation testing would not add signal.
- [ ] Run `npm run test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] For visible runtime changes that depend on submitted input, run at least one manual or route-level spot-check with non-default values and confirm the returned payload reflects those exact values.
- [ ] If the story changed visible or repeatable runtime behavior, start the local app/server and prepare a user-facing manual test handoff with the exact local URL, steps, and expected results.
- [ ] Do not rely on Playwright or other browser automation as the final acceptance gate for visible Codex stories; use the user handoff instead.
- [ ] If the story changed deployable runtime behavior, check the CI plus Railway deploy status per `docs/process/DEPLOYMENT_FLOW.md`, and use the local `railway` CLI for spot checks when needed.

## Handoff and memory sync

- [ ] Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md` with the new owner, status, and next gate.
- [ ] Update the packet docs, backlog handoff, rule index, eval result, and memory files when durable truth changed.
- [ ] Update deployment notes or blockers when external deploy state changed.
- [ ] If Railway or GitHub deploy wiring changed, update the checked-in harness docs before closing the story.
- [ ] Use `.ai/workflows/story-handoff.md` for QA-style review or final acceptance.

## Git gate

- [ ] Keep the branch scoped to this story or tightly-coupled workflow change.
- [ ] Before commit, sync the packet, tracker, eval/privacy/performance artifacts, and handoff state with the real implementation status.
- [ ] Before commit, run `npm run gate:commit`.
- [ ] Use an intentional commit message that includes the story id.
- [ ] Push to a story branch, never directly to `main` or `production`.
- [ ] Before a reviewable push, run `npm run gate:push` and re-run the required local validation for the changed surface.
- [ ] Before any QA-style handoff, final acceptance handoff, or claim that the branch is on GitHub, run `npm run gate:publish`.
