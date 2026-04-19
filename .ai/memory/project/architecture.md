# Architecture Memory

## Current application shape

- Frontend: Vite + React in `src/client`
- Backend: Express in `src/server`
- Shared boundary: Zod contracts in `src/shared/contracts`
- Harness: checked-in docs under `.ai/` plus canonical repo rules in `AGENTS.md` and `CLAUDE.md`
- UI flow harness: `STITCH_FLOW_MODE` now supports `claude-direct`, `automated`, and `manual`, with `claude-direct` as the workspace default and Stitch remaining optional per pass
- Intake backend: route-local multipart `POST /api/review` validates one required in-memory primary label file plus one optional secondary label file, accepts omitted `fields` for standalone reviews, normalizes a bounded intake object in `src/server/review-intake.ts`, then runs the extractor, warning validator, and deterministic report builder before returning the final `VerificationReport`
- Runtime review wiring: `src/client/App.tsx` now consumes the `VerificationReport` returned by `POST /api/review`, while `src/client/review-runtime.ts` decides when dev fixtures are allowed and falls back to a standalone seed report when application data is absent
- Extraction backend slice: `POST /api/review/extraction` now uses `src/server/openai-review-extractor.ts` plus `src/server/review-extraction.ts` to package in-memory uploads for the Responses API, normalize image-quality signals, and resolve beverage type before later validators run
- Extraction-routing foundation slice: `src/server/ai-provider-policy.ts` plus `src/server/review-extractor-factory.ts` now resolve extraction as a two-stage decision (`cloud` vs `local`, then provider inside that mode), keep provider choice capability-specific, and fail closed when explicit local mode lacks a local provider
- Gemini cloud cutover slice: `src/server/gemini-review-extractor.ts` now uses `@google/genai` for inline image/PDF extraction, `src/server/review-extraction-model-output.ts` holds the shared API-facing schema/prompt/normalization layer used by both Gemini and OpenAI, and the factory plus route/batch surfaces now prefer `gemini,openai` for label extraction while traces infer the actual winning provider from the returned model id
- Latency-observability slice: `src/server/review-latency.ts` now provides the typed stage-span model, outcome-path classification, and observer plumbing used by `src/server/index.ts`, `src/server/llm-trace.ts`, `src/server/review-extractor-factory.ts`, `src/server/openai-review-extractor.ts`, `src/server/gemini-review-extractor.ts`, and `src/server/batch-session.ts` to emit privacy-safe timing summaries for single-label and batch execution without changing the public API shape
- Completed hot-path tuning slice: `TTB-209` now uses the stage timing summaries to lock the winning Gemini default profile, add provider metadata telemetry, ship a broader checked-in latency corpus, raise the checked-in Gemini timeout to `5000`, and explicitly keep the visible single-label budget at `5000`
- User-centered LLM hardening slice: `TTB-210` now resolves prompt intent through `src/server/review-prompt-policy.ts`, keeps structural degradation in `src/server/review-extractor-guardrails.ts`, and extends the shared extraction surface across review, extraction-only, warning, and batch execution without route-local prompt strings
- Relevance-preflight slice: `POST /api/review/relevance` now runs an OCR-only quick scan through `src/server/review-relevance.ts`, returning a bounded advisory decision that only eager-prefetches extract-only for `likely-label` inputs while keeping the canonical review path available through an explicit continue-anyway override in the client
- Early `TTB-211` user-override slice: `src/server/llm-trace.ts` now wraps `/api/review`, `/api/review/extraction`, `/api/review/warning`, and batch run/retry inside route-surface spans, carries endpoint-surface, extraction-mode, provider, prompt-profile, guardrail-policy, client-trace, and fixture metadata, and records nested extraction, warning, and report stage summaries before those routes return their typed contracts
- `TTB-206` plus the earlier `TTB-211` foundation: `src/server/llm-policy.ts` and `src/server/llm-trace.ts` still tag the shared extraction capability with endpoint-surface, extraction-mode, provider, prompt-profile, guardrail-policy, and fixture ids, while the new extractor factory now supplies the resolved extraction mode to every single-label and batch path
- Endpoint eval slice: `evals/llm/*.eval.ts` plus `eval.vitest.config.ts` now provide a fixture-backed local gate for the current model-backed route graph, and `.github/workflows/ci.yml` runs that gate before staging deploy can trigger
- Synthetic smoke-media slice: `scripts/generate-live-label-assets.ts` plus the checked-in `evals/labels/manifest.json` now generate internal Gemini-backed PNG fixtures under `evals/labels/assets/` for smoke and harness work when authoritative label binaries are not yet available
- Warning-validation slice: `src/server/government-warning-validator.ts` now turns extracted warning text plus visual signals into the final warning `CheckReview`, and `POST /api/review/warning` stages that path end to end
- Review aggregation slice: `src/server/review-report.ts` now turns extracted fields plus the warning check into deterministic field comparisons, beverage-specific rules, cross-field checks, verdict aggregation, and the no-text fallback used by the approved results UI
- Batch execution slice: `src/server/batch-csv.ts`, `src/server/batch-matching.ts`, and `src/server/batch-session.ts` now parse uploaded CSVs, resolve filename/order matching, keep batch sessions in memory, carry one primary image plus one optional secondary image per row, stream run frames, and shape dashboard/export payloads around the existing single-label report builder
- Stored eval-sample corpus slice: `scripts/fetch-cola-cloud-labels.ts`, `scripts/generate-cola-cloud-batch-fixtures.ts`, `src/server/register-eval-routes.ts`, and `src/client/toolbench/builtin-sample-packs.ts` now preserve up to two preferred stored assets per COLA record, expose `secondary_filename` plus flattened batch image cases for upload/eval packs, and keep single-sample loading keyed to the original stored sample id with ordered `images` arrays
- Help-manifest slice: `src/shared/contracts/help.ts` plus `src/shared/help-fixture.ts` now define the typed tutorial/help contract and deterministic English manifest, `GET /api/help/manifest` serves that manifest from Express, and `src/client/help-runtime.ts` hydrates the approved help UI with a fixture fallback when the route is unavailable
- Mock-auth shell slice: `src/client/App.tsx`, `src/client/AuthScreen.tsx`, `src/client/SignedInIdentity.tsx`, and `src/client/authState.ts` now model the approved TTB-107 Screen 0 as a fully client-local auth gate; `authState.ts` holds the stable transition, delay, and sign-out reset helpers that the regression suite exercises
- Results contract: `VerificationReport` now carries verdict/counts/extraction-quality state, regular comparison evidence, warning sub-checks plus diff segments, and cross-field checks in one shared schema
- Batch UI runtime: `src/client/batch-runtime.ts` maps live batch API payloads into the established batch upload, processing, dashboard, and drill-in view models while preserving the product's approved direction and paired-image rendering
- `TTB-302` moved batch orchestration onto an explicit client-side source model in `src/client/useBatchWorkflow.ts` and `src/client/useBatchDashboardFlow.ts`: live is now the default runtime, fixture seeds are opt-in, and dashboard/report/retry/export branch on the active source instead of the global dev-fixture flag
- `TTB-303` adds a small mode-aware toolbench routing seam in `src/client/toolbenchRouteState.ts`, keeps `src/client/batchWorkflowLive.ts` append-oriented for repeated live image intake, and teaches `src/client/useBatchWorkflow.ts` to start a fresh live image set when the reviewer transitions from fixture-seeded batch state back into live files
- Batch route hardening: `src/server/register-batch-routes.ts` now marks every batch response surface as `cache-control: no-store`, including preflight, cancel, summary, report, export, and retry
- Post-handoff collaboration model: Claude establishes the initial UI direction for a story, then Codex may refine `src/client/**` during engineering once a `ready-for-codex` handoff exists, as long as the result stays aligned with the story packet, master design, and handoff hard constraints
- Planned help architecture: future guided-tour and contextual-help behavior should be delivered from typed, deterministic manifests and stateless server routes rather than persisted onboarding state

## Core execution model

- The UI consumes typed review payloads and should not contain compliance logic.
- The server owns OpenAI orchestration and deterministic validators.
- Final compliance outcomes must come from deterministic checks over structured extraction, not from a single model verdict.
- Optional reviewer guidance should come from typed, deterministic manifests and stateless routes, never from runtime-generated copy or persisted onboarding state.

## Guardrails

- No persistence of uploaded labels, application data, or review results
- No persistence of batch session data, dashboard rows, or export payloads beyond in-memory session life
- OpenAI Responses API only for new model work
- `store: false` on every request
- Gemini integrations must stay inline-only with logging and data-sharing disabled; no Files API or other durable provider-managed upload surface
- Explicit local-mode selection must stay local-only; no silent cloud escape hatch once the user picks `local`
- Latency instrumentation must stay privacy-safe: no raw prompt/input logging, no raw filenames, and no durable timing artifacts that contain user content
- Prompt and eval hardening should stay centralized: one shared extraction baseline, small endpoint/mode overlays, structural guardrails, and endpoint-aware eval scorecards rather than route-local prompt strings
- Prompt-policy hardening slice: `src/server/review-prompt-policy.ts` now resolves provider-agnostic prompt intent from route surface (`review`, `extraction`, `warning`, plus batch run/retry surfaces mapped onto `review`) plus extraction mode (`cloud`, `local`), and `src/server/review-extractor-guardrails.ts` applies structural post-parse degradation before the adapters finalize `ReviewExtraction`
- Low-confidence visual judgments downgrade to `review`
- Workflow and eval foundations gate later story pickup; once those are clear, ready approved `TTB-1xx` handoffs are preferred before later blocking `TTB-2xx+` Codex work
