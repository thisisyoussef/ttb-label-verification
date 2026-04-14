# Durable Patterns

## Workflow pattern

- Non-trivial work starts with preflight, lookup, and sizing.
- Standard feature work produces a checked-in universal packet under `docs/specs/<story-id>/`.
- Visible or branch-heavy stories add `user-flow-map.md` to the packet before implementation so every meaningful branch is planned, not rediscovered during debugging.
- Async, upload, model, and guided-flow stories add `observability-plan.md` to the packet before implementation so step transitions and failure branches are diagnosable with sanitized logs/traces.
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` is the single checked-in tracker for story ownership, status, and handoff state.
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` also resolves `continue` and `next story`; agents do not guess queue order from chat memory.
- Earlier workflow, eval, and other foundation stories are completed before later feature stories, even when a later story already has a `ready-for-codex` handoff.
- After those foundations clear, the next ready approved `TTB-1xx` handoff is preferred before later blocking `TTB-2xx+` Codex work.
- Stories with UI scope use phased execution inside the same packet: Claude follows `docs/process/UI_CLAUDE_CHECKLIST.md`, completes the UI phase, and hands off approved UI, then Codex follows `docs/process/CODEX_CHECKLIST.md` and completes the engineering phase.
- Agents block early when they are in the wrong lane and redirect the user with the exact next agent and exact file paths to use, but Claude does not treat pending Codex work as a blocker for the next UI story.
- Codex-only and Claude-only stories are allowed when scope genuinely stays in one lane.
- Durable product-level design guidance lives in `docs/design/MASTER_DESIGN.md`; feature-specific UI design belongs in `docs/specs/<story-id>/ui-component-spec.md`.
- `docs/specs/FULL_PRODUCT_SPEC.md` is the product-wide blueprint, while `docs/specs/PROJECT_STORY_INDEX.md` plus the tracker define the executable leaf-story order.
- Pre-authored leaf stories may start as `docs/specs/<story-id>/story-packet.md`; any agent may create or expand that compact packet before real implementation begins, while lane ownership still controls implementation and handoff work.
- Deployment uses a branch-linked Railway model: `main` to staging, `production` to production, with CI gating deploys and explicit production promotion.
- Validator and extraction stories also produce evidence, rule-source, privacy, performance, and eval artifacts when relevant.
- Behavior changes use RED -> GREEN -> REFACTOR through `.ai/workflows/tdd-pipeline.md`.
- Prompt, model, tool-call, and agentic LLM stories use trace-driven development through `docs/process/TRACE_DRIVEN_DEVELOPMENT.md` and `.ai/workflows/trace-driven-development.md`, with LangSmith tracing kept off outside explicit local trace runs.

## Product pattern

- Claude owns the initial frontend design pass in `src/client/**` and hands approved UI to Codex through `docs/backlog/codex-handoffs/`.
- A `ready-for-codex` handoff establishes the starting UI plus any hard constraints; it does not freeze every future client edit.
- Codex may wire approved `src/client/**` surfaces to live behavior and make story-scoped UI refinements when those changes stay aligned with the story intent and design system.
- Approved results UI should render the `VerificationReport` returned by `/api/review` directly; seeded scenarios are a dev-only fallback, not the primary runtime path.
- Dev-only scenario and batch seed controls should be explicitly gated by fixture-mode rules instead of remaining visible in normal runtime behavior.
- Claude now defaults to `STITCH_FLOW_MODE=claude-direct` and implements UI directly from the checked-in packet and design context; automated Stitch and manual Comet are explicit per-pass alternatives instead of the default.
- When a pass does use automated Stitch, it writes artifacts under `docs/specs/<story-id>/stitch-refs/automated/<timestamp>/`, uses process-level timeout guards for the destructive generation call, and still stops for explicit user review before implementation.
- Codex-only stories that the tracker marks `ready-parallel` may proceed while Claude is still on a different UI story; Codex only waits on missing UI approval for the specific story it is executing.
- Local runtime env recovery is standardized: run `npm run env:bootstrap` before reporting missing OpenAI config, and rely on the server's `.env` / `.env.local` autoload for actual local runs.
- Story work uses checked-in git gates: story-scoped branches, story-id commit messages, `npm run gate:commit` before reviewable commits, `npm run gate:push` before reviewable pushes, no routine direct pushes to `main` or `production`, and deploy-triggering merges flow through `main`.
- Publishing a normal story branch to GitHub now routes through a draft PR by default: GitHub Actions auto-open the PR, ready PRs must carry the production-grade template content, merges use GitHub's rebase-only PR path, and `ci` rejects `main` or `production` updates that are not associated with merged PRs because native branch protection is unavailable on the current private-repo plan. Use the authenticated `gh` CLI for the PR-side actions in that flow.
- Shared contracts are the handshake between Codex and Claude lanes, but Codex owns the contract files.
- When the shared contract expands, client-side fixture and helper types should alias the shared report types instead of preserving a parallel interface tree.
- Upload intake starts with route-local in-memory validation and explicit limits; no global multipart middleware is allowed.
- Multipart request parsing and normalization should live in a dedicated server module (`src/server/review-intake.ts`) so routes consume a typed result instead of re-parsing `fields` inline.
- Standalone single-label intake is represented by omitted or blank multipart `fields`, which normalize to `beverageTypeHint: 'auto'`, `origin: 'domestic'`, and `hasApplicationData: false`.
- Responses structured outputs should use an API-facing schema with required-plus-nullable fields, then normalize into the shared server contract after parsing.
- Extraction work can land behind a dedicated staging route (`POST /api/review/extraction`) while the UI-facing `POST /api/review` route remains seeded until validators and aggregation are ready.
- Validator work can follow the same pattern with a narrow staging route (`POST /api/review/warning`) as long as the validator itself remains a pure reusable module for the later full aggregation story.
- Once the staging slices exist, the production review route should cut over by composing those same pure modules into a dedicated report builder (`src/server/review-report.ts`) rather than duplicating comparison logic inside `src/server/index.ts`.
- Batch mode should follow the same pattern: keep parsing/matching/session orchestration in focused server modules, and let `src/server/index.ts` remain a thin route composition layer.
- Extraction routing should split mode from provider: planned `TTB-206` resolves `cloud` vs `local` first, planned `TTB-207` gives cloud label extraction its own `gemini,openai` order, and planned `TTB-212` adds a local Ollama/Qwen path without cross-mode fallback.
- Gemini multimodal extraction should use the native Google GenAI path with inline image/PDF bytes plus structured JSON output, not the Gemini Files API and not the OpenAI-compat layer for the core extraction path.
- Latency tuning should follow a two-step pattern: instrument stage timing first, then optimize the measured hot leg, and only after proof cut the visible `latencyBudgetMs` contract to the tighter target.
- Prompt hardening should follow the same central-policy pattern as extraction routing: one shared extraction baseline, route-specific overlays for review/extraction/warning/batch, mode-specific overlays for cloud/local limits, and structural guardrails after schema parse instead of prompt strings embedded in route handlers.
- LLM evaluation should stay endpoint-aware, mode-aware, and persona-aware: score the route graph the way Sarah, Dave, Jenny, Marcus, and Janet experience it instead of relying on corpus accuracy alone.
- Endpoint-aware eval and trace artifacts must record extraction mode alongside endpoint surface, provider, prompt profile, and guardrail policy, even when only one live mode is implemented today.
- Shared extraction tracing should wrap the capability once and feed the route surface into the wrapper instead of duplicating trace plumbing in each handler.
- Route-aware trace review for `langsmith/vitest` evals should follow the path experiment session -> eval root run -> route-surface span -> stage spans; experiment summaries alone are not sufficient evidence.
- Fixture-backed OpenAI clients are the preferred eval seam for route-aware LLM tests in this repo: they exercise the real extractor contract while keeping LangSmith traces privacy-safe and deterministic.
- Route-aware golden evals should live beside reusable support modules (`evals/llm/support/*`) and select manifest slices by endpoint surface before any broader corpus expansion.
- Cache-friendly request structuring is acceptable only for static prefixes; provider features that create durable storage of user-bearing content are not valid baseline latency solutions in this repo.
- Seed fixtures unlock UI progress before live backend integration.
- For established UI shells that need live wiring, add a pure client runtime adapter (`src/client/batch-runtime.ts`) so API-to-view-model mapping stays testable outside React components.
- The golden eval set is part of the product contract, not optional test garnish. The core-six live subset is only the first slice, not the whole corpus.
- LangSmith tracing is a local engineering tool, not runtime product behavior; it should only capture approved fixtures or sanitized inputs and should never be left on for staging or production traffic.
- Every compliance rule should be traceable through `docs/rules/RULE_SOURCE_INDEX.md`.
- Deterministic validation runs after extraction, not instead of it.
- Warning text comparison should normalize whitespace only, keep punctuation/case literal, and shape phrase-level diff segments to match the approved UI evidence contract.
- Future tutorial/help work should be optional and replayable, with critical guidance inline or in accessible panels/dialogs rather than hidden in tooltip-only affordances.
- Shared help content should follow the same contract-first pattern as review payloads: keep semantic anchor keys and manifest validation in `src/shared/contracts`, store canonical English fixture content in shared code, serve it through a stateless route, and let the client keep a local fallback instead of duplicating help copy in UI-only modules.
- Guided tours should resolve against live runtime state through a dedicated helper rather than assuming the happy path in component code; each step needs explicit recovery actions for missing prerequisites and a deterministic demo path when the flow must continue without live backend work.
- When a guided-tour step is meant to teach a real control or workflow transition, treat the footer `Next` button as a gate, not a skip-ahead shortcut. Recovery should be an explicit secondary action, while the main step completion comes from the live control or satisfied state.
- When a guided-tour target triggers async work in the real app, keep "interaction advance" separate from "footer Next": target clicks should wait for the downstream state transition before advancing, and failures should recover into a deterministic demo state instead of leaving the next step without its anchor.
- For async tour targets wired from native document listeners, preserve the pending interaction state across the click frame and the immediate pre-submit rerender; otherwise the tour can lose the user's intent before the app reaches the async state it needs to observe.
- Tour spotlight targets must stay mounted across equivalent UI states when the region still conceptually exists; for example, an upload target should remain addressable after a file is loaded, not only in the empty drop-zone variant.
- When a tour step describes evidence hidden behind an accordion or expandable row, the tour state should drive that region open before spotlighting it; otherwise the step and the visible UI drift apart.
- Overlay callouts that depend on spotlighted targets should measure their rendered height and clamp to viewport-safe margins instead of relying on fixed-height estimates; long procedural copy is normal in this product.
- Fixed-position spotlight overlays should compute target rectangles in viewport coordinates. Add scroll offsets only when the overlay itself is document-positioned; otherwise the cutout and ring will drift after scrolling.
- For branch-heavy client-only state machines, prefer a small pure helper seam for transition and reset policy (`src/client/authState.ts`) plus SSR/pure regression tests before introducing a heavier DOM-interaction harness.
- Codex workflow changes should force a blast-radius pass before implementation: when a story moves shell, navigation, results, view-state, selectors, or target anchors, inspect dependent guided-help surfaces instead of assuming the change is isolated.
- New story pickup should always move onto a fresh story branch before packet or code edits; reusing the previous story branch is a workflow violation even when the branch name is otherwise valid.
- Reviewable PRs should always describe changed surfaces, test file additions or updates, validation results, risks, and manual QA in the body; GitHub should auto-seed that structure from a checked-in template and CI should reject placeholder PR descriptions.

## Documentation pattern

- Canonical repo rules live in `AGENTS.md` and `CLAUDE.md`.
- `.ai/` mirrors and operationalizes those rules.
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` tracks active work, queue order, lane ownership, and handoff gates.
- `.ai/docs/SINGLE_SOURCE_OF_TRUTH.md` is only a compatibility mirror.
- `docs/backlog/codex-handoffs/` is the checked-in queue for approved UI work waiting on Codex engineering.
- `docs/specs/<story-id>/` is the universal story contract shared by both lanes.
- `.ai/workflows/story-handoff.md` is also used for lane redirects, not only review checkpoints.
- `.ai/workflows/continue-next-story.md` is the routing algorithm for `continue` and `continue with the next story`.
- `.ai/workflows/story-lookup.md` and `docs/process/CODEX_CHECKLIST.md` now require an explicit blast-radius map before Codex implementation.
- `docs/process/DEPLOYMENT_FLOW.md` is the canonical post-story deploy procedure.
- `evals/` stores the required label corpus and run records.
