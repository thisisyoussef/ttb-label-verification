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
- Test quality standard: `docs/process/TEST_QUALITY_STANDARD.md`
- Stitch automation rules: `docs/process/STITCH_AUTOMATION.md`
- Trace-driven development rules: `docs/process/TRACE_DRIVEN_DEVELOPMENT.md`
- Claude-to-Codex engineering queue: `docs/backlog/codex-handoffs/<story-id>.md`
- Durable product design baseline: `docs/design/MASTER_DESIGN.md`
- Repo-level rule traceability: `docs/rules/RULE_SOURCE_INDEX.md`
- Evaluation corpus and runs: `evals/golden/`, `evals/labels/`, and `evals/results/`
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
- `trace-brief.md`
- `handoff-checklist.md`

Compact planning form:

- `story-packet.md`

Use this only when pre-authoring the full leaf-story set. Once a story becomes active, any agent may create or expand the compact packet into the standard working files needed to move the story forward. Lane ownership still controls which docs each agent may author as part of implementation and handoff.

## UI-first packet phases

Packet creation is shared work:

- Any agent may create the `docs/specs/<story-id>/` folder, add `story-packet.md`, or expand a compact packet into the standard working docs.
- Claude still owns UI design artifacts, UI implementation, and the approved UI handoff.
- Codex still owns engineering artifacts, engineering implementation, and the final engineering handoff.

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
- `trace-brief.md` when prompt/model/tool-call or agentic LLM behavior needs trace-driven tuning

Gate rule:

- If a story has material UI scope, Codex waits until Claude finishes the initial UI phase and the handoff is `ready-for-codex`.
- If a Codex-only story has no pending dependency on unapproved UI, the tracker may mark it parallel-safe so Codex can execute it while Claude continues a different UI story.
- If a story has no material UI scope, Codex may proceed without a Claude handoff.
- If a story is UI-only, Claude may finish the packet without Codex implementation work.

## Creation sequence

1. Run preflight.
2. Run story lookup.
3. Run story sizing.
4. If the story is `standard` and not UI-first, create the full packet under `docs/specs/<story-id>/`. Any agent may do this when it is the one advancing the story.
5. If the story is a pre-authored compact leaf story, start from `story-packet.md` and expand it before implementation. Any agent may perform that expansion; lane rules still apply to the specific artifacts and implementation work that follow.
6. If the story is UI-first:
   - follow `docs/process/UI_CLAUDE_CHECKLIST.md`
   - Claude creates or updates `ui-component-spec.md` and `stitch-screen-brief.md`
   - default path: Claude runs the automated Stitch flow from the repo
   - fallback path: if the user explicitly sets `STITCH_FLOW_MODE=manual` or the local Stitch config is unavailable, Claude stops for a manual Comet Stitch pass
   - the generated or returned Stitch image and HTML/code references are recorded in the packet
   - Claude reviews the generated output itself first
   - Claude still stops for user review of the generated output before implementation
   - Claude implements the UI against those Stitch references
   - Claude stops for user visual review
   - Claude writes `docs/backlog/codex-handoffs/<story-id>.md` after approval
   - Codex follows `docs/process/CODEX_CHECKLIST.md` and completes the rest of the same packet only after the handoff is `ready-for-codex`, with room for story-scoped UI refinements during engineering
7. Fill the non-UI packet in this order:
   - constitution check
   - feature spec
   - technical plan
   - task breakdown
   - required relevant packet artifacts for evidence, rules, privacy, performance, or evals
8. Derive tests directly from acceptance criteria and the relevant eval cases before coding. Choose the smallest viable test layer, note the negative and boundary cases, and call out where contract, property, or mutation testing is required.
9. If the story changes prompt/model/tool-call or agentic LLM behavior, add `trace-brief.md`, run the LangSmith-backed trace loop, and record the winning traces.
10. Keep the packet, backlog handoff, rule index, and eval records current as delivered behavior changes.

## Writing rules

- `feature-spec.md` is about what and why, not how.
- `technical-plan.md` is about modules, contracts, risks, and testing. Its testing strategy must name test layers, contract seams, invariants/properties, flake hazards, and mutation-worthy modules.
- `task-breakdown.md` should contain executable steps with validation commands.
- `story-packet.md` should contain the same substance as a compact packet: constitution check, feature spec, technical plan, task breakdown, lane owner, and handoff gates.
- `ui-component-spec.md` is the per-feature design doc and should follow the feature-design contract in `CLAUDE.md`, aligned to `docs/design/MASTER_DESIGN.md`.
- `stitch-screen-brief.md` should contain the exact screen description the user runs through Google Stitch plus the returned Stitch image and HTML/code references once they exist, regardless of whether Stitch was run manually in Comet or through the optional local automation path.
- `docs/backlog/codex-handoffs/<story-id>.md` should freeze the approved UI, list the backend and contract work needed, and tell Codex what must not change.
- `evidence-contract.md` should define the exact review payload, evidence objects, confidence semantics, and UI-facing detail structure.
- `rule-source-map.md` should map every changed validator rule to authoritative sources, beverage applicability, severity, and uncertainty fallback.
- `privacy-checklist.md` should prove how the story avoids persistence in model calls, temp files, logs, caches, and response storage.
- `performance-budget.md` should break the under-5-second target into measurable sub-budgets and declare the measurement method.
- `eval-brief.md` should define the changed AI behavior, failure modes, and pass criteria.
- `trace-brief.md` should define the trace hypothesis, fixture slice, review focus, failure taxonomy, winning trace ids, and what changed between iterations.

## When a packet may be skipped

Only `trivial` tasks may skip the full packet. The lane decision must say why.

## Handoff connection

The active spec packet, rule sources, eval run, and backlog handoff are part of handoff. Final user or QA review should be able to trace the change back to the packet, the approved UI handoff when relevant, the authoritative rule sources, the eval result, and the story acceptance criteria.
