# Implementation Checklist

Despite the filename, this checklist is agent-agnostic. Use it for engineering or mixed-surface story work.

## Start gate

- [ ] If the user said `continue` or `continue with the next story`, resolve the current story through `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `.ai/workflows/continue-next-story.md`.
- [ ] Confirm no earlier workflow or eval foundation story is still `ready` or `in progress` before starting a later feature story.
- [ ] Confirm `docs/process/SINGLE_SOURCE_OF_TRUTH.md` either lists this story as active, names it as the next preferred pick, or the user explicitly selected it.
- [ ] Before packet or code edits, confirm the current branch is story-scoped. If the worktree is on `main` or `production`, switch immediately to a fresh story branch.
- [ ] Record the branch in `docs/process/BRANCH_TRACKER.md` with a non-placeholder description as soon as it is opened, preferably via `npm run story:branch -- open ...`.
- [ ] If the story only has `story-packet.md`, expand it into the standard working docs before implementation begins.
- [ ] Before declaring missing local model credentials, run `npm run env:bootstrap`.
- [ ] If the story changes prompt, model, tool-call, or agentic LLM behavior, run `npm run langsmith:smoke` before starting the trace loop.
- [ ] For material UI work, review any existing `ui-component-spec.md`, `docs/design/MASTER_DESIGN.md`, and historical handoff docs if they exist, but do not treat their absence as a blocker unless the story explicitly waits on user approval or returned assets.
- [ ] If implementation genuinely depends on missing user review, missing assets, or an unavailable manual flow, stop and ask for that exact prerequisite.

## Read set

- [ ] `AGENTS.md`
- [ ] `.ai/codex.md`
- [ ] `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- [ ] `docs/process/TEST_QUALITY_STANDARD.md`
- [ ] `docs/process/TRACE_DRIVEN_DEVELOPMENT.md` when the story changes prompt, model, tool-call, or agentic LLM behavior
- [ ] `docs/process/STITCH_AUTOMATION.md` when the story touches Stitch or the Stitch harness
- [ ] `docs/process/DEPLOYMENT_FLOW.md`
- [ ] `docs/process/GIT_HYGIENE.md`
- [ ] `docs/specs/FULL_PRODUCT_SPEC.md`
- [ ] `docs/specs/PROJECT_STORY_INDEX.md`
- [ ] `docs/presearch/2026-04-13-foundation.md`
- [ ] `docs/reference/product-docs/README.md`
- [ ] `.ai/docs/WORKSPACE_INDEX.md`
- [ ] `docs/specs/<story-id>/` packet
- [ ] `docs/specs/<story-id>/stitch-screen-brief.md` when Stitch was used
- [ ] `docs/backlog/codex-handoffs/<story-id>.md` when an older story already includes one and it still provides useful context
- [ ] `docs/design/MASTER_DESIGN.md` when extending an established UI
- [ ] `docs/rules/README.md`, `docs/rules/RULE_SOURCE_INDEX.md`, and `evals/README.md` for validator or AI behavior work
- [ ] `src/shared/contracts/review.ts`

## Packet and implementation setup

- [ ] Treat `docs/specs/<story-id>/` as the universal story packet and complete the needed working docs there.
- [ ] Treat `story-packet.md` as a compact planning artifact only; materialize the deeper docs before real engineering starts when the work calls for them.
- [ ] Complete any missing packet docs required by `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.
- [ ] For visible runtime behavior or multi-step interaction, create or update `user-flow-map.md` before coding and enumerate happy, empty, disabled, loading, success, failure, retry, cancel, back, close, reset, and skip branches.
- [ ] For async, upload, model, guided-tour, or user-reported state bugs, create or update `observability-plan.md` before coding and define the sanitized step-level logs, failure markers, and correlation fields.
- [ ] Translate the accepted behavior into contract, validator, privacy, performance, and eval requirements before coding.
- [ ] Derive tests directly from acceptance criteria and relevant eval scenarios.
- [ ] Decide the smallest viable test layer for each acceptance criterion before writing tests.
- [ ] Force a real RED state before implementation.
- [ ] When a seed adapter, staging route, or story-local bridge powers approved UI, add a RED test that uses non-default submitted values and proves those values survive into the returned contract.
- [ ] Add boundary or contract tests when route payloads, provider payloads, or shared contracts change.
- [ ] Add property tests when changing normalizers, comparators, parsers, tolerance logic, or other broad-input pure helpers.
- [ ] Note any high-risk pure modules that should get a targeted mutation check before handoff.

## Engineering work

- [ ] Implement the minimum server, shared-contract, validator, orchestration, and tooling changes needed to satisfy the packet.
- [ ] Update `src/client/**` directly when the story needs it, while keeping the result aligned with the story packet and `docs/design/MASTER_DESIGN.md` when those exist.
- [ ] Use Stitch tooling only when the story actually benefits from direct, automated, or manual Stitch flow. Harness verification and reference inspection are still valid uses.
- [ ] If you make a material UI refinement, update the relevant packet and reference docs so the new durable baseline is recorded.
- [ ] If implementation exposes a broader design question that truly needs user direction or returned Stitch assets, stop and ask for that exact input instead of inventing it.
- [ ] Implement the observability plan for step transitions and failure branches when the story includes async or multi-step behavior.
- [ ] Keep no-persistence guarantees explicit for uploads, model calls, temp files, caches, and logs.
- [ ] Keep observability privacy-safe: no raw label uploads, no raw form payload dumps, and no durable sensitive logs.
- [ ] Keep LangSmith tracing disabled outside explicit trace runs, and never trace staging or production user submissions.
- [ ] Keep low-confidence or ambiguous outcomes reversible and biased toward `review`.

## Verification gate

- [ ] Run the relevant eval slice and record the result in `evals/results/` when AI or validator behavior changes.
- [ ] For prompt, model, tool-call, or agentic LLM stories, complete the LangSmith trace loop, inspect traces and runs, and record the winning trace ids or exports in the packet and `evals/results/`.
- [ ] If `evals/golden/manifest.json` or `evals/labels/manifest.json` changed, run `npm run evals:validate`.
- [ ] Only treat missing binaries under `evals/labels/assets/` as a blocker when this story actually requires a live extraction or live eval run.
- [ ] Verify `privacy-checklist.md` items when uploads, model calls, or ephemeral data handling are involved.
- [ ] Capture measured timings when the story touches the single-label critical path.
- [ ] If the story changed high-risk pure logic such as validators, comparison helpers, or severity mapping, run a targeted mutation pass with `npm run test:mutation -- --mutate "<path>"` or explicitly record why mutation testing would not add signal.
- [ ] Run `npm run test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] For visible runtime changes that depend on submitted input, run at least one manual or route-level spot-check with non-default values and confirm the returned payload reflects those exact values.
- [ ] For multi-step or async runtime changes, execute at least one non-happy-path branch from `user-flow-map.md` and confirm the observability plan makes the branch transition and failure point obvious.
- [ ] If the story changed visible or repeatable runtime behavior, start the local app or server and prepare a user-facing manual test handoff with the exact local URL, steps, and expected results.
- [ ] Do not rely on Playwright or other browser automation as the final acceptance gate for visible stories; use the user handoff instead.
- [ ] If the story changed deployable runtime behavior, check the CI plus Railway deploy status per `docs/process/DEPLOYMENT_FLOW.md`, and use the local `railway` CLI for spot checks when needed.

## Handoff and memory sync

- [ ] Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md` with the new status, blocker, and next step.
- [ ] Update the packet docs, any still-relevant handoff docs, rule index, eval result, and memory files when durable truth changed.
- [ ] Update deployment notes or blockers when external deploy state changed.
- [ ] If Railway or GitHub deploy wiring changed, update the checked-in harness docs before closing the story.
- [ ] Use `.ai/workflows/story-handoff.md` for QA-style review or final acceptance.

## Git gate

- [ ] Keep the branch scoped to this story or tightly-coupled workflow change.
- [ ] Before commit, sync the packet, tracker, eval, privacy, performance artifacts, and story status with the real implementation state.
- [ ] Before commit, run `npm run gate:commit`.
- [ ] Use an intentional commit message that includes the story id.
- [ ] Push to a story branch, never directly to `main` or `production`.
- [ ] Before a reviewable push, run `npm run gate:push` and re-run the required local validation for the changed surface.
- [ ] Before any QA-style handoff, final acceptance handoff, or claim that the branch is on GitHub, run `npm run gate:publish`.
- [ ] If implementation happened in an isolated side worktree or branch, merge, rebase, or cherry-pick the finished diff back into the active delivery branch before final handoff.
- [ ] Before any final "done" response on mergeable story work, confirm the story branch is already merged to `main` and that `origin/main` contains the change. If not, merge first or report the exact blocker.
- [ ] If a PR exists or is being prepared, update the PR description with `.github/pull_request_template.md` and make sure tests added or updated, validation results, risks, screenshots or manual QA, and follow-ups match the real diff.
