# Single Source of Truth

Last updated: 2026-04-15 (`TTB-108` is complete with extraction-mode selection, mode-aware processing/failure states, session-timeout warning flow, and guided-tour follow-through fixes; `TTB-208` is complete with privacy-safe stage timing, route and batch latency summaries, and synthetic internal core-six smoke assets; `TTB-209` is now complete with smarter Gemini request defaults, checked-in `latency-twenty` assets, measured prompt and tier experiments, and a raised checked-in `GEMINI_TIMEOUT_MS=5000` default while the public `latencyBudgetMs` contract stays at `5000`; `TTB-210` now has centralized prompt-policy plus structural guardrails landed locally with tests, build, and fixture evals green, but its traced LangSmith evidence is blocked by current auth failures (`401 /datasets` in the Vitest flow and `403` on direct trace upload); `TTB-211` stays complete as the route-aware eval foundation; `TTB-212` local-model work was scrapped and its packet was moved to archive by user request; `TTB-302` is complete; `TTB-303` is complete with live batch add-more image appends, mode-aware toolbench image routing, focused regression tests, and local browser verification)

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
- Claude owns the UI-first lane: default to `STITCH_FLOW_MODE=claude-direct` and implement directly from the checked-in design context, or use automated/manual Stitch only when that pass explicitly needs it; then stop for visual approval and write the Codex handoff with hard constraints plus flexible areas.
- Claude continues through later UI stories after each approved handoff. Claude is not blocked by outstanding Codex engineering on earlier stories.
- Codex owns the engineering lane: complete the remaining packet, wire real behavior, refine the established UI when needed to finish the story well, and close tests, evals, privacy, and performance gates.
- Codex may update `src/client/**` after an initial Claude-created slice or `ready-for-codex` handoff exists. Those edits may include layout, styling, copy, interaction, and state-flow refinements when they stay within the story intent, `docs/design/MASTER_DESIGN.md`, and the handoff's hard constraints.
- Codex-only stories may run in parallel with Claude only when this tracker explicitly marks them ready and no pending UI approval is listed in their gate.
- Approved UI-first handoffs may stay `ready-parallel` while Codex has not started them yet; once they are the preferred active pick, update this tracker accordingly.

## Current project state

- Project status: runnable scaffold plus full-product planning set with live GitHub and Railway backing
- Runtime status: React + Express scaffold exists, the shared review contract now includes typed extraction plus warning evidence, `POST /api/review` keeps uploads in memory and now runs the integrated extraction + warning + aggregation path, `POST /api/review/seed` remains the explicit scaffold-only inspection route, `POST /api/review/extraction` runs the live extraction boundary, `POST /api/review/warning` stages the warning validator, and contracts are tested
- Process status: lane rules, next-story routing, spec gate, TDD gate, LangSmith-backed trace-driven development, Claude-direct UI flow with automated/manual Stitch alternatives, deployment flow, repo-managed git hooks, and publish-gate handoff rules are checked in
- Planning status: `TTB-106`, `TTB-107`, `TTB-108`, `TTB-206`, `TTB-207`, `TTB-208`, `TTB-209`, and the current OpenAI-backed `TTB-211` override slice are complete, including route-surface trace evidence, endpoint-aware fixture evals, privacy-safe latency summaries, smarter Gemini request defaults, and the checked-in synthetic `latency-twenty` image corpus. `TTB-108` now provides the signed-in extraction-mode choice, mode-aware processing copy and failure recovery, inactivity timeout warning, and the guided-tour recovery/gating polish needed to teach the flow against both reviewer-entered and deterministic demo paths. `TTB-207` plus `TTB-208` now provide the native Gemini adapter, shared cross-provider schema/prompt layer, Gemini-primary cloud routing, typed stage timing on the route and batch surfaces, and measured fallback-path classification without changing the visible `latencyBudgetMs: 5000` contract. `TTB-209` locked the winning Gemini runtime profile (`gemini-2.5-flash-lite`, raster `low`, PDF `medium`, Flash-family `thinkingBudget=0`), confirmed that priority and the slimmer `cloud-cross-provider-v2` prompt did not materially improve the route, raised the checked-in Gemini timeout default from `3000` to `5000`, and explicitly kept the public `latencyBudgetMs` contract at `5000` because the tighter `4000` target was not proved. The `TTB-212` local-mode packet is now archived at `docs/specs/archive/TTB-212/` by user request. The user-centered prompt/guardrail hardening follow-ons remain `TTB-210` plus `TTB-211`.
- GitHub bootstrap status: live repo exists at `thisisyoussef/ttb-label-verification`
- Railway bootstrap status: project, service, staging, production, public domains, and GitHub Actions token wiring are configured

## Active pointers

- Active Claude story: none in progress (`TTB-108` Claude lane complete and approved 2026-04-14)
- Active Codex story: none in progress
- Next ready for Claude: none queued
- Next preferred for Codex: `TTB-210`
- Next blocking for Codex: `TTB-210`, then `TTB-401`
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
| 11.5 | `TTB-302` | `TTB-003` | live-first batch runtime, workflow cleanup, and fixture demotion | Codex | `done` | keep the packet, route hardening, and local browser verification record as proof that batch now defaults to the live session path while fixtures stay explicit dev-only support | none |
| 11.6 | `TTB-303` | `TTB-003` | batch input append and toolbench mode-routing regression fix | Codex | `done` | keep the packet, regression tests, and local browser verification record as proof that repeated live image intake appends and toolbench image loads stay in the active batch workflow | none |
| 12 | `TTB-105` | `TTB-004` | accessibility, trust copy, and final UI polish | Codex | `ready-parallel` | preserve the approved polish (single-label Results `Back to Intake` breadcrumb, promoted Processing `Cancel review`) as frozen release-gate input for `TTB-401` | none |
| 13 | `TTB-106` | `TTB-004` | guided tour, replayable help, and contextual info layer | Codex | `done` | keep the packet, help contract, manifest route, fallback runtime bridge, and enforced action-step gating as the record of the completed help-layer cutover | none |
| 14 | `TTB-107` | `TTB-004` | mock Treasury auth entry and signed-in shell identity | Codex | `done` | keep the packet, handoff, and auth regression suite as the record of the completed mock-auth shell hardening | none |
| 15 | `TTB-108` | `TTB-004` | extraction mode selector and mode-aware processing states | Codex | `done` | keep the packet, signed-in mode selector, timeout warning flow, and guided-tour recovery/gating polish as the record of the completed dual-mode shell pass | none |
| 16 | `TTB-206` | `TTB-002` | extraction mode routing foundation and privacy-safe cloud/local provider policy | Codex | `done` | keep the packet, provider-policy module, extractor factory, env/bootstrap surface, and privacy guardrails as the record of the completed routing foundation | none |
| 17 | `TTB-207` | `TTB-002` | cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation | Codex | `done` | keep the packet, sanitized LangSmith comparison traces, and manual AI Studio logging-verification note as the record of the Gemini-primary cloud cutover | none |
| 18 | `TTB-208` | `TTB-002` | cloud/default latency observability and sub-4-second budget framing | Codex | `done` | keep the packet, latency observer path, eval result, and synthetic internal core-six asset note as the record of the completed timing foundation | none |
| 19 | `TTB-209` | `TTB-002` | cloud/default Gemini hot-path tuning and latency policy hardening | Codex | `done` | keep the winning Gemini defaults, the 20-case latency corpus, the eval result, and the explicit non-cutover note as the record of the completed cloud-baseline hardening slice | none |
| 21 | `TTB-210` | `TTB-002` | persona-centered prompt profiles and endpoint plus mode guardrails | Codex | `in-progress` | publish the remaining traced evidence after refreshing LangSmith auth; local code, tests, build, and fixture evals are already green | LangSmith auth currently fails with `401 /datasets` in the tracked eval flow and `403` on direct trace upload |
| 22 | `TTB-211` | `TTB-002` | LLM endpoint and mode eval matrix, persona scorecards, and trace regression gates | Codex | `done` | keep the endpoint-aware eval harness, route-surface trace evidence, persona scorecards, trace guidance, and CI golden gate as the record of the completed route-aware regression slice | none |
| 23 | `TTB-401` | `TTB-004` | final privacy, performance, eval, and submission pack | Codex | `blocked-by-dependency` | run the release gate and package the submission | `TTB-208`, `TTB-209`, and `TTB-210` complete |

## Handoff points

- Hand off to the user for Stitch review only when the current pass is using automated or manual Stitch.
- Hand off to the user for visual review after Claude has a runnable screen set aligned to the selected UI flow.
- Hand off to Codex only after the user approves the UI direction and `docs/backlog/codex-handoffs/<story-id>.md` is `ready-for-codex`.
- A `ready-for-codex` handoff may still be non-blocking. Use `ready-parallel` in this tracker when Codex can execute the handoff and it is waiting in the preferred `TTB-1xx` handoff queue.
- Claude does not need a Codex completion to continue the next UI story. Claude resolves the next UI-ready item from this file.
- Codex does not need Claude to finish a different active UI story when this tracker already marks a Codex-only story or approved UI-first handoff `ready-parallel`.
- Hand off back to Claude only if Codex needs a net-new UI direction, broader redesign, or fresh Stitch/user-review loop.
- Hand off to QA-style review or final acceptance after Codex completes engineering, tests, evals, privacy checks, and timing proof.
- After deployable Codex stories, report staging deployment status or the exact CI/Railway deploy failure.

## Update rules

- This file is the only checked-in tracker for active story, lane owner, queue status, and next gate.
- The checklist docs are procedural references. Do not use them as status trackers.
- Update this file when the active story changes, a handoff changes state, ownership moves between Claude and Codex, or the blocking / executable-parallel pointers change.
- When an approved `TTB-1xx` UI-first handoff can proceed independently of a still-active Claude story, mark that explicitly here with `ready-parallel` so Codex can prefer it before later `TTB-2xx+` engine work.
- Keep backlog handoff status language aligned with `docs/backlog/README.md`.
- Story packet shape and creation methodology live in `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.
