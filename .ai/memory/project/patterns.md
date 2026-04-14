# Durable Patterns

## Workflow pattern

- Non-trivial work starts with preflight, lookup, and sizing.
- Standard feature work produces a checked-in universal packet under `docs/specs/<story-id>/`.
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

- Claude owns frontend design in `src/client/**` and hands approved UI to Codex through `docs/backlog/codex-handoffs/`.
- Codex may wire approved `src/client/**` surfaces to live behavior as long as the design contract stays fixed.
- Approved results UI should render the `VerificationReport` returned by `/api/review` directly; seeded scenarios are a dev-only fallback, not the primary runtime path.
- Dev-only scenario and batch seed controls should be explicitly gated by fixture-mode rules instead of remaining visible in normal runtime behavior.
- Claude uses the local automated Stitch flow by default and stops for user review after generated refs are recorded; manual Comet Stitch is an explicit fallback when the pass is switched to `STITCH_FLOW_MODE=manual` or local Stitch auth is unavailable.
- The automated Stitch lane writes artifacts under `docs/specs/<story-id>/stitch-refs/automated/<timestamp>/`, uses process-level timeout guards for the destructive generation call, and still stops for explicit user review before implementation.
- Codex-only stories that the tracker marks `ready-parallel` may proceed while Claude is still on a different UI story; Codex only waits on missing UI approval for the specific story it is executing.
- Local runtime env recovery is standardized: run `npm run env:bootstrap` before reporting missing OpenAI config, and rely on the server's `.env` / `.env.local` autoload for actual local runs.
- Story work uses checked-in git gates: story-scoped branches, story-id commit messages, `npm run gate:commit` before reviewable commits, `npm run gate:push` before reviewable pushes, no routine direct pushes to `main` or `production`, and deploy-triggering merges flow through `main`.
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
- Seed fixtures unlock UI progress before live backend integration.
- For frozen UI shells that need live wiring, add a pure client runtime adapter (`src/client/batch-runtime.ts`) so API-to-view-model mapping stays testable outside React components.
- The golden eval set is part of the product contract, not optional test garnish. The core-six live subset is only the first slice, not the whole corpus.
- LangSmith tracing is a local engineering tool, not runtime product behavior; it should only capture approved fixtures or sanitized inputs and should never be left on for staging or production traffic.
- Every compliance rule should be traceable through `docs/rules/RULE_SOURCE_INDEX.md`.
- Deterministic validation runs after extraction, not instead of it.
- Warning text comparison should normalize whitespace only, keep punctuation/case literal, and shape phrase-level diff segments to match the approved UI evidence contract.
- Future tutorial/help work should be optional and replayable, with critical guidance inline or in accessible panels/dialogs rather than hidden in tooltip-only affordances.

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
