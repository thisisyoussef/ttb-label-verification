# Codex Engineering Checklist

Use this checklist whenever Codex is the active lane owner for a story.

## Start gate

- [ ] If the user said `continue` or `continue with the next story`, resolve the current story through `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `.ai/workflows/continue-next-story.md`.
- [ ] Confirm `docs/process/SINGLE_SOURCE_OF_TRUTH.md` shows the story as Codex-owned, engineering-ready, or `ready-for-codex`.
- [ ] For any story with material UI scope, confirm `docs/backlog/codex-handoffs/<story-id>.md` exists and is marked `ready-for-codex`.
- [ ] Confirm the task belongs to the engineering lane, not frontend design.
- [ ] If the story only has `story-packet.md`, expand it into the standard working docs before implementation begins.
- [ ] If the task needs frontend design or the approved UI handoff is missing, stop and redirect the user to Claude.

## Read set

- [ ] `AGENTS.md`
- [ ] `.ai/codex.md`
- [ ] `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- [ ] `docs/process/DEPLOYMENT_FLOW.md`
- [ ] `docs/specs/FULL_PRODUCT_SPEC.md`
- [ ] `docs/specs/PROJECT_STORY_INDEX.md`
- [ ] `docs/presearch/2026-04-13-foundation.md`
- [ ] `docs/reference/product-docs/README.md`
- [ ] `CLAUDE.md`
- [ ] `.ai/docs/WORKSPACE_INDEX.md`
- [ ] `docs/specs/<story-id>/` packet
- [ ] `docs/specs/<story-id>/stitch-screen-brief.md` when Stitch was used
- [ ] `docs/backlog/codex-handoffs/<story-id>.md` when the story starts from approved UI
- [ ] `docs/design/MASTER_DESIGN.md` when preserving a frozen UI contract
- [ ] `docs/rules/README.md`, `docs/rules/RULE_SOURCE_INDEX.md`, and `evals/README.md` for validator or AI behavior work
- [ ] `src/shared/contracts/review.ts`

## Packet and implementation setup

- [ ] Treat `docs/specs/<story-id>/` as the universal story packet and complete the engineering parts there rather than creating a separate backend-only spec.
- [ ] Treat `story-packet.md` as a compact planning artifact only; materialize the deeper docs before real engineering starts.
- [ ] Complete any missing packet docs required by `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.
- [ ] Translate the accepted behavior into contract, validator, privacy, performance, and eval requirements before coding.
- [ ] Derive tests directly from acceptance criteria and relevant eval scenarios.
- [ ] Force a real RED state before implementation.

## Engineering work

- [ ] Implement the minimum server, shared-contract, validator, orchestration, and tooling changes needed to satisfy the packet.
- [ ] Keep frontend design fixed. Do not redesign `src/client/**`, copy, layout, or interaction flow. Preserve the approved Stitch-based UI direction when Stitch references exist.
- [ ] If engineering exposes a required UI gap, write it back to `docs/backlog/codex-handoffs/<story-id>.md` and hand it back instead of patching the design directly.
- [ ] When a UI gap blocks engineering, stop and tell the user explicitly to switch to Claude with the relevant packet and backlog handoff files.
- [ ] Keep no-persistence guarantees explicit for uploads, model calls, temp files, caches, and logs.
- [ ] Keep low-confidence or ambiguous outcomes reversible and biased toward `review`.

## Verification gate

- [ ] Run the relevant eval slice and record the result in `evals/results/` when AI or validator behavior changes.
- [ ] Verify `privacy-checklist.md` items when uploads, model calls, or ephemeral data handling are involved.
- [ ] Capture measured timings when the story touches the single-label critical path.
- [ ] Run `npm run test`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] If the story changed deployable runtime behavior and GitHub plus Railway are configured, report staging deployment status per `docs/process/DEPLOYMENT_FLOW.md`.

## Handoff and memory sync

- [ ] Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md` with the new owner, status, and next gate.
- [ ] Update the packet docs, backlog handoff, rule index, eval result, and memory files when durable truth changed.
- [ ] Update deployment notes or blockers when external bootstrap state changed.
- [ ] Use `.ai/workflows/story-handoff.md` for QA-style review or final acceptance.
