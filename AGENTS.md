# AGENTS

This file is the canonical operating contract for this project. `.ai/` mirrors it for tool-specific workflows, but does not override it.

## Read order

1. `AGENTS.md`
2. `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
3. `docs/specs/FULL_PRODUCT_SPEC.md`
4. `docs/presearch/2026-04-13-foundation.md`
5. `docs/reference/env-audit-2026-04-13.md`
6. `docs/process/TRACE_DRIVEN_DEVELOPMENT.md`
7. `docs/process/TEST_QUALITY_STANDARD.md`
8. `docs/process/STITCH_AUTOMATION.md`
9. `docs/reference/product-docs/README.md`
10. `docs/process/DEPLOYMENT_FLOW.md`
11. `docs/process/GIT_HYGIENE.md`
12. `CLAUDE.md`
13. `.ai/docs/WORKSPACE_INDEX.md`
14. `src/shared/contracts/review.ts`

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
- `docs/process/TRACE_DRIVEN_DEVELOPMENT.md` for LangSmith-backed trace loops on LLM and agentic stories
- `docs/process/TEST_QUALITY_STANDARD.md` for repo-level test design, hermeticity, contract coverage, property tests, and mutation checks
- `docs/process/STITCH_AUTOMATION.md` for the Claude-direct default UI flow plus automated/manual Stitch alternatives
- `docs/process/DEPLOYMENT_FLOW.md` for repo bootstrap, Railway CLI flow, and story-to-deploy wiring
- `docs/process/GIT_HYGIENE.md` for branch, commit, push, and merge gates
- `docs/design/MASTER_DESIGN.md` for durable UI direction
- `docs/rules/` for rule traceability and source mapping
- `evals/` for required label scenarios, expected outcomes, and run records

## Product invariants

- This is a standalone proof of concept for TTB label verification.
- No uploaded label image, application form data, or verification result may be persisted.
- OpenAI integrations must use the Responses API with `store: false`.
- LangSmith tracing is development-only, disabled by default, and may use only approved local fixtures or sanitized inputs. Do not trace staging or production label submissions.
- A model may extract and classify, but final compliance outcomes must come from deterministic rules and typed contracts.
- When confidence is low, especially for bold text, spatial layout, or same-field-of-vision judgments, the result defaults to `review`.
- The single-label flow targets a sub-5-second response budget.

## Ownership split

- Claude Code owns frontend design in `src/client/**`: screens, layout, states, interaction flow, copy, accessibility, and seeded fixtures that define the approved UI.
- Claude Code does not change `src/server/**`, `src/shared/**`, validators, tests, API boundaries, OpenAI orchestration, or infrastructure. If UI work needs new data, fields, or behavior, Claude records that requirement in `docs/backlog/codex-handoffs/<story-id>.md`.
- Codex owns engineering only: `src/server/**`, `src/shared/**`, validators, API boundaries, OpenAI orchestration, integration, tests, tooling, and infrastructure.
- Codex must treat approved frontend design as fixed input. Codex may edit `src/client/**` only for non-design integration wiring, data flow, request state, and contract hookup needed to stitch the approved UI into the working product. Do not change layout, styling, copy, interaction flow, or visual hierarchy unless the user explicitly overrides this rule.
- Shared types in `src/shared/contracts` are the handshake point, but ownership of those contracts stays with Codex.
- `.ai/codex.md` is the Codex execution mirror. `CLAUDE.md` is the Claude operating contract. `.ai/agents/claude.md` only mirrors that at a high level.

## Blocking and redirect rules

- If the active agent is in the wrong lane, it must stop before edits and redirect the user to the correct agent.
- Claude blocks and redirects to Codex only when the user is explicitly asking Claude to perform server, shared contract, validator, OpenAI, test, integration, or infrastructure work.
- Claude blocks and redirects to the user only when the selected UI flow still needs Stitch output, whether that means reviewing automated refs or returning manual Comet assets.
- Codex blocks and redirects to Claude when the task needs frontend design, screen structure, layout, copy, interaction design, or a new Stitch brief/visual pass.
- Codex blocks and redirects to Claude when the specific story in question has UI scope but the Claude UI phase is not complete or the backlog handoff is not `ready-for-codex`.
- Codex does not block just because Claude or the user currently owns a different story. If `docs/process/SINGLE_SOURCE_OF_TRUTH.md` exposes a Codex-ready parallel-safe story with no pending UI dependency, Codex may take that story.
- Approved UI-first handoffs may be executable for Codex before they become the blocking next story. Keep those handoffs `ready-for-codex` in `docs/backlog/codex-handoffs/`, and mark them `ready-parallel` in `docs/process/SINGLE_SOURCE_OF_TRUTH.md` when they are executable Codex work. After workflow/eval foundations are clear, prefer the earliest ready `TTB-1xx` handoff ahead of later blocking `TTB-2xx+` engineering work.
- If Codex discovers a required UI change during engineering, it must stop, write the follow-up back to the backlog handoff, and redirect the user to Claude instead of patching the UI directly.
- Claude does not block just because Codex has ready or blocked engineering work. Claude keeps moving through the UI queue from `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, and Codex stitches the approved UI into the working product afterward.
- Redirect messages must be explicit: name the blocker, name the next agent, and name the exact artifact or file the next agent should use.

## Continue and next-story resolution

- When the user says `continue`, `continue the story`, or `continue with the next story`, the active agent must resolve that request from `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, not from chat memory.
- If the current lane already has an active in-progress story, continue that story first.
- For Codex, distinguish workflow/eval foundations from executable UI handoff work. If any earlier workflow or eval foundation leaf story is still `ready` or `in progress`, finish that foundation item first.
- After workflow/eval foundations are clear, tracker-marked approved `TTB-1xx` UI handoffs that remain `ready-for-codex` in backlog docs take priority over later blocking `TTB-2xx+` engineering work. Finish those ready `TTB-1xx` Codex handoffs first unless another story is already active or the user explicitly picks a different story.
- Claude resolves against the Claude queue only. Earlier Codex-ready work does not block Claude from continuing later UI stories.
- Otherwise, use the tracker pointers. Claude follows `Next ready for Claude`. Codex follows the tracker’s preferred ready `TTB-1xx` handoff pointer first, then the blocking Codex pointer when no ready `TTB-1xx` handoff remains.
- If the next step for the active agent is a manual user action such as returning Stitch assets, block immediately and ask for that action instead of guessing.
- Keep the tracker current enough that either Claude or Codex can recover the next valid story just from the checked-in docs.

## Story rules

- Start non-trivial work with the `agent-preflight` skill and publish the brief before edits.
- When the user asks to continue work or move to the next story, run `.ai/workflows/continue-next-story.md`.
- Run `.ai/workflows/story-lookup.md` before meaningful implementation.
- Run `.ai/workflows/story-sizing.md` to classify the task as `trivial` or `standard`.
- Treat `docs/specs/<story-id>/` as the universal story packet for both frontend and backend work. Claude and Codex read the same packet and update the parts owned by their lane.
- Use `docs/specs/FULL_PRODUCT_SPEC.md` plus `docs/specs/PROJECT_STORY_INDEX.md` as the full checked-in map of the product. The legacy `TTB-001` through `TTB-004` folders are umbrella packets; the `TTB-1xx`, `TTB-2xx`, `TTB-3xx`, and `TTB-4xx` stories are the executable leaf queue.
- A planning-stage leaf story may begin as `docs/specs/<story-id>/story-packet.md`. Any agent may create or expand that compact packet into the standard artifact set when moving the story forward. Lane ownership still controls which parts of the packet, implementation, and handoff each agent may complete.
- Deployment scaffolding lives in repo code and process docs: `.github/workflows/`, `railway.toml`, `scripts/bootstrap-github-repo.sh`, and `docs/process/DEPLOYMENT_FLOW.md`.
- Use the local `railway` CLI for Railway bootstrap, status, logs, and manual spot checks. Do not treat ad hoc dashboard clicks as the harness source of truth.
- Follow `docs/process/GIT_HYGIENE.md` before committing, pushing, or merging. Use `npm run gate:commit` before reviewable commits, `npm run gate:push` before reviewable pushes, and `npm run gate:publish` before any handoff or final response that claims the branch is available on GitHub. Story work happens on story-scoped branches, not directly on `main` or `production`.
- For `standard` non-UI-first work, run `.ai/workflows/spec-driven-delivery.md` and write the artifact set under `docs/specs/<story-id>/` using the conventions in `docs/specs/README.md` and `.ai/docs/SPEC_CREATION_METHODOLOGY.md`.
- For stories with material UI scope, Claude follows `docs/process/UI_CLAUDE_CHECKLIST.md` plus `docs/process/STITCH_AUTOMATION.md`: create or update `docs/specs/<story-id>/ui-component-spec.md`, use `docs/specs/<story-id>/stitch-screen-brief.md` only when the selected mode uses Stitch, implement directly when `STITCH_FLOW_MODE=claude-direct` (default), or self-review generated refs before user review when `STITCH_FLOW_MODE=automated`, or stop for Comet assets when `STITCH_FLOW_MODE=manual`, then get user visual approval and finally write `docs/backlog/codex-handoffs/<story-id>.md`.
- Codex must not begin implementation work for a story with UI scope until the Claude UI phase is complete and the handoff is marked `ready-for-codex`.
- Codex may begin a Codex-only story in parallel with Claude only when the tracker explicitly marks that story ready for Codex and the packet does not depend on pending UI approval or a missing Claude handoff. Approved UI-first handoffs that are executable should stay `ready-for-codex` in backlog docs and be marked `ready-parallel` in the tracker until Codex picks them up or completes them.
- For engineering stories and approved UI handoffs, Codex follows `docs/process/CODEX_CHECKLIST.md` before implementation and final handoff.
- After an approved UI-first handoff exists, Codex runs `.ai/workflows/codex-from-ui-handoff.md`, completes the remaining packet under the same `docs/specs/<story-id>/` folder, and implements the engineering work without redesigning the frontend.
- Some stories may be one-agent only. Claude-only stories still use the packet when they are non-trivial. Codex-only stories may proceed without a Claude handoff when there is no material UI scope.
- Before declaring that local OpenAI runtime configuration is missing, run `npm run env:bootstrap`. The server loads repo-local `.env` and `.env.local` automatically outside tests.
- Treat `evals/golden/manifest.json` as the canonical golden eval set and `evals/labels/manifest.json` as the live image-backed core-six subset. Missing binaries under `evals/labels/assets/` only block stories that actually require a live extraction or live eval run.
- If a story changes extraction, validator behavior, evidence payloads, or result detail structure, add `evidence-contract.md`, `rule-source-map.md`, and `eval-brief.md` to the packet.
- If a story changes prompts, model selection, tool-calling behavior, agentic orchestration, or other LLM behavior that must be tuned for consistency, add `trace-brief.md` to the packet and run `docs/process/TRACE_DRIVEN_DEVELOPMENT.md` plus `.ai/workflows/trace-driven-development.md`.
- If a story touches uploads, model calls, request/response logging, temp files, or any ephemeral data handling, add `privacy-checklist.md` and prove the negative cases.
- If a story touches the single-label critical path, add `performance-budget.md` and carry measured timings into handoff.
- Keep the full golden eval set tracked in `evals/golden/` and the live core-six subset tracked in `evals/labels/`, and record story-specific eval runs in `evals/results/`.
- For all behavior changes, run `.ai/workflows/tdd-pipeline.md`.
- For all behavior changes, use `docs/process/TEST_QUALITY_STANDARD.md` to choose test layers, contract seams, invariants, and mutation targets before coding.
- Derive tests directly from acceptance criteria, require a real RED state before implementation, and keep refactor as a separate step after GREEN.
- Keep `docs/process/SINGLE_SOURCE_OF_TRUTH.md` current when active work, status, next owner, or handoff state changes.
- When deployable implementation work is completed, follow `docs/process/DEPLOYMENT_FLOW.md` so CI plus Railway CLI deploys staging after merge to `main`.
- Production promotion is explicit. Do not treat a completed story as production-shipped unless the production branch or Railway production environment was actually promoted.
- Promote recurring corrections into `AGENTS.md` or the relevant `.ai/workflows/*.md` file instead of leaving them as chat-only knowledge.
- Use `.ai/workflows/story-handoff.md` for lane redirects, Stitch prep, visual review, UI-to-Codex backlog handoff, QA-style review, and final user acceptance handoff.

## Engineering rules

- TDD is the default. Start with a failing test for every non-trivial shared contract or validator change.
- Keep the suite pyramid-shaped: many small hermetic tests, some focused integration or contract tests, and very few high-level tests.
- Good tests in this repo must be fast, isolated, repeatable, self-checking, and explicit. If a test needs retries, sleeps, or machine-specific state, fix the seam instead of normalizing flake.
- For any story-local adapter, seeded fallback, or staging route that powers approved UI, TDD must assert real user-entered values survive the boundary and appear in the returned contract. Shape-only tests are not enough.
- Add contract tests when a route boundary, shared payload, or provider payload changes.
- Add property tests when changing broad-input pure logic such as normalizers, comparators, parsers, or tolerance checks.
- For high-risk pure logic such as validators, severity mapping, or comparison helpers, run a targeted mutation pass with `npm run test:mutation -- --mutate "<path>"` or record why it would not add signal.
- Keep the first model pass narrow: extract structured facts from label/application inputs. Do not ask the model to decide compliance holistically.
- For LLM or agentic tuning work, use trace-driven development alongside TDD: trace the smallest approved fixture slice, inspect LangSmith, adjust one variable at a time, and record the winning traces.
- Run deterministic checks after extraction: government warning text, required-field presence, formatting rules, cross-field consistency, and beverage-type rules.
- Keep low-confidence visual claims reversible and explicit. Uncertain extraction must not become a hard `pass`.
- Do not introduce persistence, queues, or background jobs unless the presearch is updated and the user asks for it.
- Prefer small, auditable modules over a single opaque agent chain.

## UI code hygiene

- `CLAUDE.md` owns the detailed UI hygiene rules for frontend code.
- Keep `src/client/**` flat and direct. Avoid deep nesting and avoid barrel files.
- Soft cap UI files at 300 lines and treat 500 lines as a hard stop requiring extraction.
- Keep components and hooks single-purpose. Split layout, state ownership, and repeated regions before they collapse into one large file.
- Extract repeated UI structure or logic once it appears in 2 meaningful places or when duplication starts hiding intent.
- Keep validation, rule interpretation, domain policy, and transport normalization out of UI components.
- When Codex touches `src/client/**` for integration wiring, preserve these hygiene constraints instead of adding one-off glue that makes the approved UI harder to maintain.

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
- `npm run gate:commit`
- `npm run gate:push` before any reviewable or deploy-triggering push
- `npm run gate:publish` before any QA-style handoff, final acceptance handoff, or claim that the branch is published on GitHub
- `npm run test:mutation -- --mutate "<path>"` for changed high-risk pure modules, or an explicit waiver in the handoff
- Re-read `docs/process/SINGLE_SOURCE_OF_TRUTH.md` when story ownership, handoff state, or queue status changes during the work.
- Re-read `.ai/docs/WORKSPACE_INDEX.md` when the harness or planning docs change.
- For extraction, validator, or evidence-payload stories, run `.ai/workflows/eval-gate.md` and record the result in `evals/results/`.
- For prompt, model, tool-calling, or agentic LLM stories, run `.ai/workflows/trace-driven-development.md`, verify `npm run langsmith:smoke`, and record the trace ids or exported evidence in the packet and `evals/results/`.
- For upload or model stories, verify `privacy-checklist.md` items explicitly, including `store: false`, no durable files, and no raw sensitive logging.
- For visible runtime changes that depend on submitted inputs, verify with a non-default manual spot-check that the returned payload and rendered result reflect the actual entered values, not just seeded defaults.
- For latency-sensitive single-label stories, include measured timings against `performance-budget.md` before final handoff.
- Run `.ai/workflows/story-handoff.md` and include the correct handoff type for the story: lane redirect, direction, Stitch prep, visual review, UI-to-Codex backlog handoff, QA-style review, or final acceptance.
- Start the dev server when the scaffold or UI changes materially, and use that same route in the user visual-review handoff.
- For Codex stories that change visible or repeatable runtime behavior, hand the running local route to the user with a concrete manual test script. Do not treat Playwright or other browser automation as the acceptance gate for those stories.
- For deployable implementation stories, report whether staging deployment is verified, incidental with no runtime delta, or failed with the exact CI/Railway blocker.

## Delivery expectations

Final handoff should name the architectural changes, describe the execution flow, call out any remaining rule-ingestion or integration gaps, point to any updated spec, rule-source, eval, privacy, or memory artifacts, and include exact review/test steps when the story changes visible or repeatable behavior.
