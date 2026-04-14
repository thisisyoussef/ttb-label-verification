# Specs

Use `docs/specs/<story-id>/` for standard feature packets.

Each packet is universal to that story. Claude and Codex both work from the same folder instead of keeping separate frontend and backend spec trees.

Use `docs/specs/FULL_PRODUCT_SPEC.md` for the product-wide blueprint and `docs/specs/PROJECT_STORY_INDEX.md` for the ordered leaf-story queue.

Use `docs/backlog/codex-handoffs/<story-id>.md` for approved UI-phase handoffs from Claude to Codex.

Use `docs/design/MASTER_DESIGN.md` as the durable product-level design baseline.

Use `docs/reference/product-docs/ttb-user-personas.md` when a story changes UX, trust copy, help, dashboard behavior, accessibility posture, or documentation intended for evaluators like Marcus and Sarah.

Use `docs/process/DEPLOYMENT_FLOW.md` for GitHub repo bootstrap, Railway environment mapping, staging deploy rules, and production promotion.

Story IDs should follow the conventions in `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.

The current repo uses two packet depths:

- umbrella packets: `TTB-001` through `TTB-004` and `TTB-EVAL-001`
- executable leaf stories: `TTB-1xx`, `TTB-2xx`, `TTB-3xx`, and `TTB-4xx`

Recommended packet:

- `constitution-check.md`
- `feature-spec.md`
- `technical-plan.md`
- `task-breakdown.md`
- `ui-component-spec.md` when UI scope is material; this is the per-feature design doc, not a separate `design.md`
- `stitch-screen-brief.md` when the UI flow uses Google Stitch; this holds the prompt Claude writes plus the returned Stitch references, whether those references came from the project-default automated flow or an explicit manual Comet fallback
- `evidence-contract.md` when result payloads, evidence objects, or detail views change
- `rule-source-map.md` when validator logic or citations change
- `privacy-checklist.md` when uploads, logs, temp files, or model calls change
- `performance-budget.md` when the single-label critical path changes
- `eval-brief.md` when AI behavior changes
- `trace-brief.md` when prompt/model/tool-call or agentic LLM behavior needs trace-driven tuning in LangSmith

Compact planning packet:

- `story-packet.md` is allowed for pre-authored leaf stories so the full product can be decomposed without creating a large forest of half-active working files.
- Before active implementation starts, any agent may expand the compact packet into the standard working docs needed to move the story forward. Lane ownership still controls implementation and handoff work.

Method:

1. preflight
2. story lookup
3. story sizing
4. if the story starts in Claude's UI lane, create or update `ui-component-spec.md` and `stitch-screen-brief.md`
5. default to the local automated Stitch flow so the repo generates image plus HTML/code references itself; only switch to a user-run Comet pass when the user explicitly sets `STITCH_FLOW_MODE=manual` for that pass
6. review the generated Stitch output yourself first, then stop for user review before implementation
7. Claude implements the UI against the approved Stitch references, then stops for visual review
7. if the story has UI scope, Codex waits for the approved UI handoff, then completes the remaining packet from that same story folder
8. add the relevant evidence, rule-source, privacy, performance, and eval artifacts
9. add `trace-brief.md` and run the trace-driven loop when the story includes prompt/model/tool-call or agentic LLM tuning
10. tests derived from acceptance criteria and the relevant eval cases
11. implementation through the TDD workflow
12. review and acceptance through `.ai/workflows/story-handoff.md`

Current note:

- The checked-in `TTB-*` packets are initiative-level foundations for the full product. They are not yet the final leaf-story decomposition of every screen, validator, and edge path.

Current checked-in packet:

- `FULL_PRODUCT_SPEC.md` — full product blueprint, architecture shape, env needs, and leaf-story map
- `PROJECT_STORY_INDEX.md` — project completion story queue
- `TTB-WF-001/` — workflow foundation upgrade
- `TTB-EVAL-001/` — golden eval set foundation and run discipline
- `TTB-001/` — single-label reviewer workflow and evidence surfaces
- `TTB-002/` — single-label compliance engine and recommendation API
- `TTB-003/` — batch triage workflow and processing pipeline
- `TTB-004/` — accessibility, hardening, and submission pack
- `TTB-101/` to `TTB-401/` — compact executable leaf-story packets
