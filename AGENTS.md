# AGENTS

This file is the canonical operating contract for this project. `.ai/` mirrors it for tool-specific workflows, but does not override it.

## Read order

1. `AGENTS.md`
2. `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
3. `docs/specs/FULL_PRODUCT_SPEC.md`
4. `docs/presearch/2026-04-13-foundation.md`
5. `docs/reference/env-audit-2026-04-13.md`
6. `docs/reference/product-docs/README.md`
7. `docs/process/DEPLOYMENT_FLOW.md`
8. `CLAUDE.md`
9. `.ai/docs/WORKSPACE_INDEX.md`
10. `src/shared/contracts/review.ts`

## Working model

- Build from checked-in docs and code, not from chat memory.
- Treat `.ai/` as helper scaffolding for this workspace, not product runtime code.
- Treat `docs/specs/` as the checked-in home for standard feature planning artifacts.
- Treat `docs/rules/` and `evals/` as project-specific quality rails for compliance traceability and model/validator evaluation.
- Treat `docs/process/SINGLE_SOURCE_OF_TRUTH.md` as the canonical checked-in tracker for lane status, active story, and handoff gates.

## Documentation sources

Use the checked-in docs deliberately, not as background noise:

- `docs/process/` for the active tracker and lane checklists
- `docs/specs/` for the universal story packet, full product blueprint, and story queue
- `docs/reference/product-docs/` for imported product and domain source material
- `docs/reference/` for env and integration audit notes
- `docs/process/DEPLOYMENT_FLOW.md` for repo bootstrap, Railway environments, and story-to-deploy wiring
- `docs/design/MASTER_DESIGN.md` for durable UI direction
- `docs/rules/` for rule traceability and source mapping
- `evals/` for required label scenarios, expected outcomes, and run records

## Product invariants

- This is a standalone proof of concept for TTB label verification.
- No uploaded label image, application form data, or verification result may be persisted.
- OpenAI integrations must use the Responses API with `store: false`.
- A model may extract and classify, but final compliance outcomes must come from deterministic rules and typed contracts.
- When confidence is low, especially for bold text, spatial layout, or same-field-of-vision judgments, the result defaults to `review`.
- The single-label flow targets a sub-5-second response budget.

## Ownership split

- Claude Code owns frontend design only: `src/client/**`, screens, layout, states, interaction flow, copy, accessibility, and seeded fixtures used to present the UI.
- Claude Code does not change `src/server/**`, `src/shared/**`, validators, tests, API boundaries, OpenAI orchestration, or infrastructure. If UI work needs new data, fields, or behavior, Claude records that requirement in `docs/backlog/codex-handoffs/<story-id>.md`.
- Codex owns engineering only: `src/server/**`, `src/shared/**`, validators, API boundaries, OpenAI orchestration, integration, tests, tooling, and infrastructure.
- Codex must treat approved frontend design as fixed input. Do not change `src/client/**`, layout, styling, copy, interaction flow, or visual hierarchy unless the user explicitly overrides this rule.
- Shared types in `src/shared/contracts` are the handshake point, but ownership of those contracts stays with Codex.
- `.ai/codex.md` is the Codex execution mirror. `CLAUDE.md` is the Claude operating contract. `.ai/agents/claude.md` only mirrors that at a high level.

## Blocking and redirect rules

- If the active agent is in the wrong lane, it must stop before edits and redirect the user to the correct agent.
- Claude blocks and redirects to Codex when the next required work is server, shared contract, validator, OpenAI, test, integration, or infrastructure work.
- Claude blocks and redirects to the user when Stitch output is required and `stitch-screen-brief.md` is ready but Stitch image/HTML references have not been returned yet.
- Codex blocks and redirects to Claude when the task needs frontend design, screen structure, layout, copy, interaction design, or a new Stitch brief/visual pass.
- Codex blocks and redirects to Claude when a story has UI scope but the Claude UI phase is not complete or the backlog handoff is not `ready-for-codex`.
- If Codex discovers a required UI change during engineering, it must stop, write the follow-up back to the backlog handoff, and redirect the user to Claude instead of patching the UI directly.
- Redirect messages must be explicit: name the blocker, name the next agent, and name the exact artifact or file the next agent should use.

## Continue and next-story resolution

- When the user says `continue`, `continue the story`, or `continue with the next story`, the active agent must resolve that request from `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, not from chat memory.
- If the current lane already has an active in-progress story, continue that story first.
- Otherwise, pick the first highest-priority story in the tracker whose next owner matches the active agent and whose status is actually ready for that lane.
- If the highest-priority ready item belongs to the other agent, or if the next step is a manual user action such as returning Stitch assets, block immediately and redirect instead of guessing.
- Keep the tracker current enough that either Claude or Codex can recover the next valid story just from the checked-in docs.

## Story rules

- Start non-trivial work with the `agent-preflight` skill and publish the brief before edits.
- When the user asks to continue work or move to the next story, run `.ai/workflows/continue-next-story.md`.
- Run `.ai/workflows/story-lookup.md` before meaningful implementation.
- Run `.ai/workflows/story-sizing.md` to classify the task as `trivial` or `standard`.
- Treat `docs/specs/<story-id>/` as the universal story packet for both frontend and backend work. Claude and Codex read the same packet and update the parts owned by their lane.
- Use `docs/specs/FULL_PRODUCT_SPEC.md` plus `docs/specs/PROJECT_STORY_INDEX.md` as the full checked-in map of the product. The legacy `TTB-001` through `TTB-004` folders are umbrella packets; the `TTB-1xx`, `TTB-2xx`, `TTB-3xx`, and `TTB-4xx` stories are the executable leaf queue.
- A planning-stage leaf story may begin as `docs/specs/<story-id>/story-packet.md`. Before implementation starts, the active agent expands that compact packet into the standard artifact set if the story needs deeper working files.
- Deployment scaffolding lives in repo code and process docs: `.github/workflows/`, `railway.toml`, `scripts/bootstrap-github-repo.sh`, and `docs/process/DEPLOYMENT_FLOW.md`.
- For `standard` non-UI-first work, run `.ai/workflows/spec-driven-delivery.md` and write the artifact set under `docs/specs/<story-id>/` using the conventions in `docs/specs/README.md` and `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.
- For stories with material UI scope, Claude follows `docs/process/UI_CLAUDE_CHECKLIST.md`: create or update `docs/specs/<story-id>/ui-component-spec.md` and `docs/specs/<story-id>/stitch-screen-brief.md`, stop for the user to run Google Stitch manually, then implement `src/client/**` from the returned Stitch image and HTML references, get user visual approval, and finally write `docs/backlog/codex-handoffs/<story-id>.md`.
- Codex must not begin implementation work for a story with UI scope until the Claude UI phase is complete and the handoff is marked `ready-for-codex`.
- For engineering stories and approved UI handoffs, Codex follows `docs/process/CODEX_CHECKLIST.md` before implementation and final handoff.
- After an approved UI-first handoff exists, Codex runs `.ai/workflows/codex-from-ui-handoff.md`, completes the remaining packet under the same `docs/specs/<story-id>/` folder, and implements the engineering work without redesigning the frontend.
- Some stories may be one-agent only. Claude-only stories still use the packet when they are non-trivial. Codex-only stories may proceed without a Claude handoff when there is no material UI scope.
- If a story changes extraction, validator behavior, evidence payloads, or result detail structure, add `evidence-contract.md`, `rule-source-map.md`, and `eval-brief.md` to the packet.
- If a story touches uploads, model calls, request/response logging, temp files, or any ephemeral data handling, add `privacy-checklist.md` and prove the negative cases.
- If a story touches the single-label critical path, add `performance-budget.md` and carry measured timings into handoff.
- Keep the six-label evaluation corpus tracked in `evals/labels/` and record story-specific eval runs in `evals/results/`.
- For all behavior changes, run `.ai/workflows/tdd-pipeline.md`.
- Derive tests directly from acceptance criteria, require a real RED state before implementation, and keep refactor as a separate step after GREEN.
- Keep `docs/process/SINGLE_SOURCE_OF_TRUTH.md` current when active work, status, next owner, or handoff state changes.
- When deployable implementation work is completed and GitHub plus Railway are configured, follow `docs/process/DEPLOYMENT_FLOW.md` so the story reaches Railway staging after merge to `main`.
- Production promotion is explicit. Do not treat a completed story as production-shipped unless the production branch or Railway production environment was actually promoted.
- Promote recurring corrections into `AGENTS.md` or the relevant `.ai/workflows/*.md` file instead of leaving them as chat-only knowledge.
- Use `.ai/workflows/story-handoff.md` for lane redirects, Stitch prep, visual review, UI-to-Codex backlog handoff, QA-style review, and final user acceptance handoff.

## Engineering rules

- TDD is the default. Start with a failing test for every non-trivial shared contract or validator change.
- Keep the first model pass narrow: extract structured facts from label/application inputs. Do not ask the model to decide compliance holistically.
- Run deterministic checks after extraction: government warning text, required-field presence, formatting rules, cross-field consistency, and beverage-type rules.
- Keep low-confidence visual claims reversible and explicit. Uncertain extraction must not become a hard `pass`.
- Do not introduce persistence, queues, or background jobs unless the presearch is updated and the user asks for it.
- Prefer small, auditable modules over a single opaque agent chain.

## Memory bank updates after work

Refresh the smallest set needed after each story:

- `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- `.ai/memory/project/architecture.md`
- `.ai/memory/project/patterns.md`
- `.ai/memory/project/anti-patterns.md`
- `.ai/memory/project/technical-debt.md`
- `.ai/memory/session/active-context.md`
- `.ai/memory/session/decisions-today.md`
- `.ai/memory/session/blockers.md`

## Verification before handoff

- `npm run test`
- `npm run typecheck`
- `npm run build`
- Re-read `docs/process/SINGLE_SOURCE_OF_TRUTH.md` when story ownership, handoff state, or queue status changes during the work.
- Re-read `.ai/docs/WORKSPACE_INDEX.md` when the harness or planning docs change.
- For extraction, validator, or evidence-payload stories, run `.ai/workflows/eval-gate.md` and record the result in `evals/results/`.
- For upload or model stories, verify `privacy-checklist.md` items explicitly, including `store: false`, no durable files, and no raw sensitive logging.
- For latency-sensitive single-label stories, include measured timings against `performance-budget.md` before final handoff.
- Run `.ai/workflows/story-handoff.md` and include the correct handoff type for the story: lane redirect, direction, Stitch prep, visual review, UI-to-Codex backlog handoff, QA-style review, or final acceptance.
- Start the dev server when the scaffold or UI changes materially, and use that same route in the user visual-review handoff.
- For deployable implementation stories, report whether staging deployment is verified, skipped because the change was docs-only, or blocked because GitHub/Railway bootstrap is not configured yet.

## Delivery expectations

Final handoff should name the architectural changes, describe the execution flow, call out any remaining rule-ingestion or integration gaps, point to any updated spec, rule-source, eval, privacy, or memory artifacts, and include exact review/test steps when the story changes visible or repeatable behavior.
