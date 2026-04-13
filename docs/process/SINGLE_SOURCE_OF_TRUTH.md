# Single Source of Truth

Last updated: 2026-04-13

## Continue resolution

- When the user says `continue`, `continue the story`, or `continue with the next story`, the active agent reads this file first.
- If the agent already owns an in-progress story, continue that story.
- Otherwise, use the `Next ready for Claude` or `Next ready for Codex` pointer below.
- If the next step belongs to the other agent or to the user, block and redirect instead of skipping the queue.
- Never infer story order from chat memory when this file disagrees.

## Workflow strategy

- `docs/specs/FULL_PRODUCT_SPEC.md` is the product-wide blueprint.
- `docs/specs/PROJECT_STORY_INDEX.md` is the ordered leaf-story queue.
- `docs/specs/<story-id>/` is the universal story packet for that story.
- Existing `TTB-001` through `TTB-004` folders remain umbrella packets for the major product areas.
- New `TTB-1xx`, `TTB-2xx`, `TTB-3xx`, and `TTB-4xx` stories are the executable leaf queue.
- A planning-stage leaf story may start as `story-packet.md`; the active agent expands it before implementation when deeper working docs are needed.
- Claude owns the UI-first lane: prepare `stitch-screen-brief.md`, stop for the user to run Google Stitch, implement the approved screens in `src/client/**`, stop for visual approval, then write the Codex handoff.
- Codex owns the engineering lane: complete the remaining packet, wire real behavior, preserve approved UI, and close tests, evals, privacy, and performance gates.

## Current project state

- Project status: runnable scaffold plus full-product planning set
- Runtime status: React + Express scaffold exists, seed API is live, shared contracts are tested
- Process status: lane rules, next-story routing, spec gate, TDD gate, Stitch handoff flow, deployment flow, and memory-bank update rules are checked in
- GitHub bootstrap status: not created yet
- Railway bootstrap status: config files are checked in, but external project and environment linkage are not configured yet

## Active pointers

- Active Claude story: none in progress
- Active Codex story: none in progress
- Next ready for Claude: `TTB-101`
- Next ready for Codex: `TTB-EVAL-001`
- Current blocker owner: none
- Current manual user action: choose GitHub repo slug/owner and complete Railway project linkage when ready

## Story queue snapshot

| Order | Story ID | Parent | Title | Next owner | Status | Next action | Blocking gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `TTB-WF-001` | workflow | workflow foundation upgrade | Codex | `done-as-baseline` | keep current harness aligned as the product spec expands | none |
| 1 | `TTB-EVAL-001` | eval foundation | six-label eval corpus and run discipline | Codex | `ready` | finalize corpus assets, expected outcomes, and run-log discipline | none |
| 2 | `TTB-101` | `TTB-001` | single-label intake and processing UI | Claude | `ready` | expand the compact packet if needed, write/update Stitch brief, and start the UI lane | none |
| 3 | `TTB-102` | `TTB-001` | single-label results, warning evidence, and standalone UI | Claude | `blocked-by-dependency` | continue after `TTB-101` is visually approved | approved `TTB-101` direction |
| 4 | `TTB-201` | `TTB-002` | shared review contract expansion and seed fixture alignment | Codex | `blocked-by-dependency` | start after `TTB-102` is approved for engineering handoff | approved `TTB-102` handoff |
| 5 | `TTB-202` | `TTB-002` | single-label upload intake, normalization, and ephemeral file handling | Codex | `blocked-by-dependency` | implement request intake after contract expansion | `TTB-201` complete |
| 6 | `TTB-203` | `TTB-002` | extraction adapter, beverage inference, and image-quality assessment | Codex | `blocked-by-dependency` | implement the first live model pass | `TTB-202` complete |
| 7 | `TTB-204` | `TTB-002` | government warning validator and diff evidence | Codex | `blocked-by-dependency` | implement the showcase validator | `TTB-203` complete |
| 8 | `TTB-205` | `TTB-002` | field comparison, beverage rules, cross-field checks, and recommendation aggregation | Codex | `blocked-by-dependency` | finish the single-label intelligence path | `TTB-204` complete |
| 9 | `TTB-103` | `TTB-003` | batch intake, matching review, and progress UI | Claude | `blocked-by-dependency` | design the batch entry flow after the single-label UX is approved | approved `TTB-102` direction |
| 10 | `TTB-104` | `TTB-003` | batch dashboard, drill-in shell, and export UI | Claude | `blocked-by-dependency` | continue after `TTB-103` is visually approved | approved `TTB-103` direction |
| 11 | `TTB-301` | `TTB-003` | batch parser, matcher, orchestration, and session export | Codex | `blocked-by-dependency` | build the batch engine behind the approved UI | `TTB-205` complete and approved `TTB-104` handoff |
| 12 | `TTB-105` | `TTB-004` | accessibility, trust copy, and final UI polish | Claude | `blocked-by-dependency` | polish the integrated UI before release gating | `TTB-301` complete |
| 13 | `TTB-401` | `TTB-004` | final privacy, performance, eval, and submission pack | Codex | `blocked-by-dependency` | run the release gate and package the submission | `TTB-105` complete |

## Handoff points

- Hand off to the user for Stitch generation after Claude has produced `stitch-screen-brief.md`.
- Hand off to the user for visual review after Claude has a runnable screen set aligned to Stitch.
- Hand off to Codex only after the user approves the UI direction and `docs/backlog/codex-handoffs/<story-id>.md` is `ready-for-codex`.
- Hand off back to Claude if Codex finds a required UI change.
- Hand off to QA-style review or final acceptance after Codex completes engineering, tests, evals, privacy checks, and timing proof.
- After deployable Codex stories, report staging deployment status or the exact external bootstrap blocker.

## Update rules

- This file is the only checked-in tracker for active story, lane owner, queue status, and next gate.
- The checklist docs are procedural references. Do not use them as status trackers.
- Update this file when the active story changes, a handoff changes state, ownership moves between Claude and Codex, or the next-ready pointers change.
- Keep backlog handoff status language aligned with `docs/backlog/README.md`.
- Story packet shape and creation methodology live in `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.
