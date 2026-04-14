# Single Source of Truth

Last updated: 2026-04-14 (`TTB-106` Claude lane is approved and ready for Codex integration, `TTB-107` is the next ready Claude story, and Gemini provider migration is now planned as `TTB-206` plus `TTB-207` before `TTB-401`)

## Continue resolution

- When the user says `continue`, `continue the story`, or `continue with the next story`, the active agent reads this file first.
- If the agent already owns an in-progress story, continue that story.
- Earlier workflow, eval, and other foundation stories gate later Codex work.
- Otherwise, use the `Next ready for Claude`, `Next preferred for Codex`, or `Next blocking for Codex` pointer below.
- Claude resolves only against the Claude queue. Pending Codex work does not block future UI stories.
- Codex clears workflow/eval foundations first, then prefers ready approved `TTB-1xx` UI handoffs before later blocking `TTB-2xx+` engineering work.
- Approved UI-first handoffs remain `ready-for-codex` in backlog docs and may stay `ready-parallel` in the tracker until Codex picks them up or completes them.
- If the next step for the active agent belongs to the user, block and ask for that exact action instead of skipping the queue.
- Never infer story order from chat memory when this file disagrees.

## Workflow strategy

- `docs/specs/FULL_PRODUCT_SPEC.md` is the product-wide blueprint.
- `docs/specs/PROJECT_STORY_INDEX.md` is the ordered leaf-story queue.
- `docs/specs/<story-id>/` is the universal story packet for that story.
- Existing `TTB-001` through `TTB-004` folders remain umbrella packets for the major product areas.
- New `TTB-1xx`, `TTB-2xx`, `TTB-3xx`, and `TTB-4xx` stories are the executable leaf queue.
- A planning-stage leaf story may start as `story-packet.md`; any agent may create or expand that packet before implementation when deeper working docs are needed. Lane ownership still controls implementation and handoff work.
- Claude owns the UI-first lane: prepare `stitch-screen-brief.md`, run the local automated Stitch flow by default, stop for user review of the generated refs, implement the approved screens in `src/client/**`, stop for visual approval, then write the Codex handoff. Manual Comet Stitch is an explicit fallback.
- Claude continues through later UI stories after each approved handoff. Claude is not blocked by outstanding Codex engineering on earlier stories.
- Codex owns the engineering lane: complete the remaining packet, wire real behavior, preserve approved UI, and close tests, evals, privacy, and performance gates.
- Codex may update `src/client/**` only to stitch approved UI into live behavior without redesigning it.
- Codex-only stories may run in parallel with Claude only when this tracker explicitly marks them ready and no pending UI approval is listed in their gate.
- Approved UI-first handoffs may stay `ready-parallel` while Codex has not started them yet; once they are the preferred active pick, update this tracker accordingly.

## Current project state

- Project status: runnable scaffold plus full-product planning set with live GitHub and Railway backing
- Runtime status: React + Express scaffold exists, the shared review contract now includes typed extraction plus warning evidence, `POST /api/review` keeps uploads in memory and now runs the integrated extraction + warning + aggregation path, `POST /api/review/seed` remains the explicit scaffold-only inspection route, `POST /api/review/extraction` runs the live extraction boundary, `POST /api/review/warning` stages the warning validator, and contracts are tested
- Process status: lane rules, next-story routing, spec gate, TDD gate, LangSmith-backed trace-driven development, automated-first Stitch flow with manual fallback, deployment flow, repo-managed git hooks, and publish-gate handoff rules are checked in
- Planning status: `TTB-106` now has a ready-parallel Codex handoff, `TTB-107` is the next queued Claude story, and Gemini provider migration is now captured as `TTB-206` plus `TTB-207` without changing the existing UI-first Codex priority rule
- GitHub bootstrap status: live repo exists at `thisisyoussef/ttb-label-verification`
- Railway bootstrap status: project, service, staging, production, public domains, and GitHub Actions token wiring are configured

## Active pointers

- Active Claude story: none in progress (`TTB-106` Claude lane complete and approved 2026-04-14)
- Active Codex story: none in progress (`TTB-301` complete 2026-04-13; `TTB-106` and `TTB-206` are both ready picks, with `TTB-106` still preferred by lane rules)
- Next ready for Claude: `TTB-107` — the mock Treasury auth entry + signed-in shell identity story is now unblocked by the approved `TTB-106` handoff
- Next preferred for Codex: `TTB-106` (`ready-parallel`) — typed help contract + stateless manifest routes remain the earliest ready approved `TTB-1xx` handoff; `TTB-206` is the next Codex-only engine story after that handoff priority clears
- Next blocking for Codex: `TTB-206` — provider routing foundation and privacy-safe Gemini/OpenAI capability policy; `TTB-207` follows it, and `TTB-401` now waits on `TTB-106`, `TTB-107`, and `TTB-207`
- Current blocker owner: none
- Current manual user action: none

## Story queue snapshot

| Order | Story ID | Parent | Title | Next owner | Status | Next action | Blocking gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `TTB-WF-001` | workflow | workflow foundation upgrade | Codex | `done-as-baseline` | keep current harness aligned as the product spec expands | none |
| 1 | `TTB-EVAL-001` | eval foundation | golden eval set foundation and run discipline | Codex | `done-as-baseline` | keep the golden set, live core-six subset, template, and gate docs aligned as later stories land | none |
| 2 | `TTB-101` | `TTB-001` | single-label intake and processing UI | Codex | `done` | keep the packet and handoff as the record of the completed intake-to-processing integration | none |
| 3 | `TTB-102` | `TTB-001` | single-label results, warning evidence, and standalone UI | Codex | `done` | keep the packet and handoff as the record of the completed live-results integration and fixture gating | none |
| 4 | `TTB-201` | `TTB-002` | shared review contract expansion and seed fixture alignment | Codex | `done` | keep the packet and eval result as the record of the contract cutover | none |
| 5 | `TTB-202` | `TTB-002` | single-label upload intake, normalization, and ephemeral file handling | Codex | `done` | keep the packet as the record of the in-memory intake boundary and optional-fields normalization | none |
| 6 | `TTB-203` | `TTB-002` | extraction adapter, beverage inference, and image-quality assessment | Codex | `done` | keep the packet, extraction route, and blocked live-eval note as the record of the first live model pass | none |
| 7 | `TTB-204` | `TTB-002` | government warning validator and diff evidence | Codex | `done` | keep the packet, warning route, and eval note as the record of the warning-validation slice | none |
| 8 | `TTB-205` | `TTB-002` | field comparison, beverage rules, cross-field checks, and recommendation aggregation | Codex | `done` | keep the packet and eval result as the record of the integrated `/api/review` cutover | none |
| 9 | `TTB-103` | `TTB-003` | batch intake, matching review, and progress UI | Codex | `done` | keep the packet and handoff as the record of the completed shell integration and dev-fixture gating while `TTB-301` remains the real batch-engine story | none |
| 10 | `TTB-104` | `TTB-003` | batch dashboard, drill-in shell, and export UI | Codex | `ready-parallel` | preserve the approved batch dashboard + drill-in shell (verbatim reuse of the `TTB-102` Results view) + session-scoped export UI as frozen input; backend execution still lands under `TTB-301` once `TTB-205` completes | none |
| 11 | `TTB-301` | `TTB-003` | batch parser, matcher, orchestration, and session export | Codex | `done` | keep the packet, eval note, and live smoke record as the proof that the approved batch shells now run against the real session-scoped engine | none |
| 12 | `TTB-105` | `TTB-004` | accessibility, trust copy, and final UI polish | Codex | `ready-parallel` | preserve the approved polish (single-label Results `Back to Intake` breadcrumb, promoted Processing `Cancel review`) as frozen release-gate input for `TTB-401` | none |
| 13 | `TTB-106` | `TTB-004` | guided review, replayable help, and contextual info layer | Codex | `ready-parallel` | preserve the approved guided-tour spotlight + info anchor layer; add the typed help contract, stateless `/api/help/manifest` route, and cutover the client fixture per the handoff doc | none |
| 14 | `TTB-107` | `TTB-004` | mock Treasury auth entry and signed-in shell identity | Claude | `ready` | design the prototype-safe mock auth entry and signed-in shell; the `TTB-106` help launcher will move inside the signed-in header when this story lands | none |
| 15 | `TTB-206` | `TTB-002` | provider routing foundation and privacy-safe Gemini/OpenAI capability policy | Codex | `ready` | implement the provider capability registry, fallback policy, env/bootstrap surface, and no-persistence guardrails from the new packet | none |
| 16 | `TTB-207` | `TTB-002` | Gemini-primary label extraction with OpenAI fallback and cross-provider validation | Codex | `blocked-by-dependency` | implement Gemini-primary extraction after `TTB-206`, then run trace, eval, privacy, and performance gates before any default flip | `TTB-206` complete |
| 17 | `TTB-401` | `TTB-004` | final privacy, performance, eval, and submission pack | Codex | `blocked-by-dependency` | run the release gate and package the submission | `TTB-106` complete and `TTB-107` complete and `TTB-207` complete |

## Handoff points

- Hand off to the user for Stitch review after Claude has produced automated Stitch refs, unless the user explicitly switched the current pass to manual Comet generation.
- Hand off to the user for visual review after Claude has a runnable screen set aligned to Stitch.
- Hand off to Codex only after the user approves the UI direction and `docs/backlog/codex-handoffs/<story-id>.md` is `ready-for-codex`.
- A `ready-for-codex` handoff may still be non-blocking. Use `ready-parallel` in this tracker when Codex can execute the handoff and it is waiting in the preferred `TTB-1xx` handoff queue.
- Claude does not need a Codex completion to continue the next UI story. Claude resolves the next UI-ready item from this file.
- Codex does not need Claude to finish a different active UI story when this tracker already marks a Codex-only story or approved UI-first handoff `ready-parallel`.
- Hand off back to Claude if Codex finds a required UI change.
- Hand off to QA-style review or final acceptance after Codex completes engineering, tests, evals, privacy checks, and timing proof.
- After deployable Codex stories, report staging deployment status or the exact CI/Railway deploy failure.

## Update rules

- This file is the only checked-in tracker for active story, lane owner, queue status, and next gate.
- The checklist docs are procedural references. Do not use them as status trackers.
- Update this file when the active story changes, a handoff changes state, ownership moves between Claude and Codex, or the blocking / executable-parallel pointers change.
- When an approved `TTB-1xx` UI-first handoff can proceed independently of a still-active Claude story, mark that explicitly here with `ready-parallel` so Codex can prefer it before later `TTB-2xx+` engine work.
- Keep backlog handoff status language aligned with `docs/backlog/README.md`.
- Story packet shape and creation methodology live in `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.
