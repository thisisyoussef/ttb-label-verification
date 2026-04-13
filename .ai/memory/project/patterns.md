# Durable Patterns

## Workflow pattern

- Non-trivial work starts with preflight, lookup, and sizing.
- Standard feature work produces a checked-in universal packet under `docs/specs/<story-id>/`.
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` is the single checked-in tracker for story ownership, status, and handoff state.
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` also resolves `continue` and `next story`; agents do not guess queue order from chat memory.
- Stories with UI scope use phased execution inside the same packet: Claude follows `docs/process/UI_CLAUDE_CHECKLIST.md`, completes the UI phase, and hands off approved UI, then Codex follows `docs/process/CODEX_CHECKLIST.md` and completes the engineering phase.
- Agents block early when they are in the wrong lane and redirect the user with the exact next agent and exact file paths to use.
- Codex-only and Claude-only stories are allowed when scope genuinely stays in one lane.
- Durable product-level design guidance lives in `docs/design/MASTER_DESIGN.md`; feature-specific UI design belongs in `docs/specs/<story-id>/ui-component-spec.md`.
- `docs/specs/FULL_PRODUCT_SPEC.md` is the product-wide blueprint, while `docs/specs/PROJECT_STORY_INDEX.md` plus the tracker define the executable leaf-story order.
- Pre-authored leaf stories may start as `docs/specs/<story-id>/story-packet.md`; the owning agent expands that compact packet before real implementation begins.
- Deployment uses a branch-linked Railway model: `main` to staging, `production` to production, with CI gating deploys and explicit production promotion.
- Validator and extraction stories also produce evidence, rule-source, privacy, performance, and eval artifacts when relevant.
- Behavior changes use RED -> GREEN -> REFACTOR through `.ai/workflows/tdd-pipeline.md`.

## Product pattern

- Claude owns `src/client/**` and hands approved UI to Codex through `docs/backlog/codex-handoffs/`.
- Claude stops for Stitch and blocks on missing Stitch references before implementation in the Stitch-assisted UI flow.
- Shared contracts are the handshake between Codex and Claude lanes, but Codex owns the contract files.
- Seed fixtures unlock UI progress before live backend integration.
- The six-label eval corpus is part of the product contract, not optional test garnish.
- Every compliance rule should be traceable through `docs/rules/RULE_SOURCE_INDEX.md`.
- Deterministic validation runs after extraction, not instead of it.

## Documentation pattern

- Canonical repo rules live in `AGENTS.md` and `CLAUDE.md`.
- `.ai/` mirrors and operationalizes those rules.
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` tracks active work, queue order, lane ownership, and handoff gates.
- `.ai/docs/SINGLE_SOURCE_OF_TRUTH.md` is only a compatibility mirror.
- `docs/backlog/codex-handoffs/` is the checked-in queue for approved UI work waiting on Codex engineering.
- `docs/specs/<story-id>/` is the universal story contract shared by both lanes.
- `.ai/workflows/story-handoff.md` is also used for lane redirects, not only review checkpoints.
- `.ai/workflows/continue-next-story.md` is the routing algorithm for `continue` and `continue with the next story`.
- `docs/process/DEPLOYMENT_FLOW.md` is the canonical post-story deploy procedure.
- `evals/` stores the required label corpus and run records.
