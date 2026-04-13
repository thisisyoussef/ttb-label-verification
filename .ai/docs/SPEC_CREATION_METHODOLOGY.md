# Spec Creation Methodology

## Purpose

Define where specs live, how stories are named, and how a standard story packet is created before implementation.

The packet is universal: frontend and backend work share the same `docs/specs/<story-id>/` folder.

## Story and spec locations

- Standard feature packet: `docs/specs/<story-id>/`
- Full product blueprint: `docs/specs/FULL_PRODUCT_SPEC.md`
- Workflow or harness packet: `docs/specs/<story-id>/`
- Canonical process tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- Claude UI lane checklist: `docs/process/UI_CLAUDE_CHECKLIST.md`
- Codex engineering lane checklist: `docs/process/CODEX_CHECKLIST.md`
- Claude-to-Codex engineering queue: `docs/backlog/codex-handoffs/<story-id>.md`
- Durable product design baseline: `docs/design/MASTER_DESIGN.md`
- Repo-level rule traceability: `docs/rules/RULE_SOURCE_INDEX.md`
- Evaluation corpus and runs: `evals/labels/` and `evals/results/`
- Product reference source docs: `docs/reference/product-docs/`

## Story ID conventions

Use a stable prefix so the packet is obvious from the path:

- `TTB-001`, `TTB-002`, ... for umbrella product areas
- `TTB-1xx` for executable single-label and UI leaf stories
- `TTB-2xx` for executable single-label engineering leaf stories
- `TTB-3xx` for executable batch leaf stories
- `TTB-4xx` for executable hardening and release leaf stories
- `TTB-BUG-001`, `TTB-BUG-002`, ... for targeted regressions or bug-fix packets
- `TTB-WF-001`, `TTB-WF-002`, ... for workflow or harness changes
- `TTB-EVAL-001`, `TTB-EVAL-002`, ... for evaluation-only or quality-gate work

## Standard packet shape

Required for `standard` work overall. Both agents work from this same packet:

- `constitution-check.md`
- `feature-spec.md`
- `technical-plan.md`
- `task-breakdown.md`

Optional when relevant:

- `ui-component-spec.md`
- `stitch-screen-brief.md`
- `evidence-contract.md`
- `rule-source-map.md`
- `privacy-checklist.md`
- `performance-budget.md`
- `eval-brief.md`
- `handoff-checklist.md`

Compact planning form:

- `story-packet.md`

Use this only when pre-authoring the full leaf-story set. Once a story becomes active, the owning agent expands the compact packet into the standard working files it needs before implementation.

## UI-first packet phases

When a story starts in Claude's UI lane:

Phase A: Claude design pass

- `ui-component-spec.md`
- `stitch-screen-brief.md`
- optional `handoff-checklist.md`
- Stitch prep handoff to the user
- implementation against returned Stitch image and HTML references
- visual review handoff to the user
- `docs/backlog/codex-handoffs/<story-id>.md` after approval

Phase B: Codex engineering pass

- `constitution-check.md`
- `feature-spec.md`
- `technical-plan.md`
- `task-breakdown.md`
- `evidence-contract.md` when the result payload or evidence model changes
- `rule-source-map.md` when validator logic or citations change
- `privacy-checklist.md` when uploads, logging, storage, or model calls change
- `performance-budget.md` when the single-label critical path changes
- `eval-brief.md` when relevant

Gate rule:

- If a story has material UI scope, Codex waits until Claude finishes the UI phase and the handoff is `ready-for-codex`.
- If a story has no material UI scope, Codex may proceed without a Claude handoff.
- If a story is UI-only, Claude may finish the packet without Codex implementation work.

## Creation sequence

1. Run preflight.
2. Run story lookup.
3. Run story sizing.
4. If the story is `standard` and not UI-first, create the full packet under `docs/specs/<story-id>/`.
5. If the story is a pre-authored compact leaf story, start from `story-packet.md` and expand it before implementation.
6. If the story is UI-first:
   - follow `docs/process/UI_CLAUDE_CHECKLIST.md`
   - Claude creates or updates `ui-component-spec.md` and `stitch-screen-brief.md`
   - Claude stops for the user to run Google Stitch manually
   - the user returns Stitch image and HTML/code references
   - Claude implements the UI against those Stitch references
   - Claude stops for user visual review
   - Claude writes `docs/backlog/codex-handoffs/<story-id>.md` after approval
   - Codex follows `docs/process/CODEX_CHECKLIST.md` and completes the rest of the same packet only after the handoff is `ready-for-codex`
7. Fill the non-UI packet in this order:
   - constitution check
   - feature spec
   - technical plan
   - task breakdown
   - required relevant packet artifacts for evidence, rules, privacy, performance, or evals
8. Derive tests directly from acceptance criteria and the relevant eval cases before coding.
9. Keep the packet, backlog handoff, rule index, and eval records current as delivered behavior changes.

## Writing rules

- `feature-spec.md` is about what and why, not how.
- `technical-plan.md` is about modules, contracts, risks, and testing.
- `task-breakdown.md` should contain executable steps with validation commands.
- `story-packet.md` should contain the same substance as a compact packet: constitution check, feature spec, technical plan, task breakdown, lane owner, and handoff gates.
- `ui-component-spec.md` is the per-feature design doc and should follow the feature-design contract in `CLAUDE.md`, aligned to `docs/design/MASTER_DESIGN.md`.
- `stitch-screen-brief.md` should contain the exact screen description the user runs through Google Stitch plus the returned Stitch image and HTML/code references once they exist.
- `docs/backlog/codex-handoffs/<story-id>.md` should freeze the approved UI, list the backend and contract work needed, and tell Codex what must not change.
- `evidence-contract.md` should define the exact review payload, evidence objects, confidence semantics, and UI-facing detail structure.
- `rule-source-map.md` should map every changed validator rule to authoritative sources, beverage applicability, severity, and uncertainty fallback.
- `privacy-checklist.md` should prove how the story avoids persistence in model calls, temp files, logs, caches, and response storage.
- `performance-budget.md` should break the under-5-second target into measurable sub-budgets and declare the measurement method.
- `eval-brief.md` should define the changed AI behavior, failure modes, and pass criteria.

## When a packet may be skipped

Only `trivial` tasks may skip the full packet. The lane decision must say why.

## Handoff connection

The active spec packet, rule sources, eval run, and backlog handoff are part of handoff. Final user or QA review should be able to trace the change back to the packet, the approved UI handoff when relevant, the authoritative rule sources, the eval result, and the story acceptance criteria.
