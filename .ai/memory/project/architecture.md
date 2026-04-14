# Architecture Memory

## Current application shape

- Frontend: Vite + React in `src/client`
- Backend: Express in `src/server`
- Shared boundary: Zod contracts in `src/shared/contracts`
- Harness: checked-in docs under `.ai/` plus canonical repo rules in `AGENTS.md` and `CLAUDE.md`
- UI flow harness: `STITCH_FLOW_MODE` now supports `claude-direct`, `automated`, and `manual`, with `claude-direct` as the workspace default and Stitch remaining optional per pass
- Intake backend: route-local multipart `POST /api/review` validates one in-memory label file, accepts omitted `fields` for standalone reviews, normalizes a bounded intake object in `src/server/review-intake.ts`, then runs the extractor, warning validator, and deterministic report builder before returning the final `VerificationReport`
- Runtime review wiring: `src/client/App.tsx` now consumes the `VerificationReport` returned by `POST /api/review`, while `src/client/review-runtime.ts` decides when dev fixtures are allowed and falls back to a standalone seed report when application data is absent
- Extraction backend slice: `POST /api/review/extraction` now uses `src/server/openai-review-extractor.ts` plus `src/server/review-extraction.ts` to package in-memory uploads for the Responses API, normalize image-quality signals, and resolve beverage type before later validators run
- Planned provider-routing slice: follow-on stories `TTB-206` and `TTB-207` will insert a capability-based Gemini/OpenAI routing layer in front of extraction and future model-backed capabilities, but the live runtime is still OpenAI-only until those stories land
- Planned latency-hardening slice: follow-on stories `TTB-208` and `TTB-209` will add stage-level timing plus hot-path tuning so the visible single-label budget can eventually move from `5000` to `4000`
- Warning-validation slice: `src/server/government-warning-validator.ts` now turns extracted warning text plus visual signals into the final warning `CheckReview`, and `POST /api/review/warning` stages that path end to end
- Review aggregation slice: `src/server/review-report.ts` now turns extracted fields plus the warning check into deterministic field comparisons, beverage-specific rules, cross-field checks, verdict aggregation, and the no-text fallback used by the approved results UI
- Batch execution slice: `src/server/batch-csv.ts`, `src/server/batch-matching.ts`, and `src/server/batch-session.ts` now parse uploaded CSVs, resolve filename/order matching, keep batch sessions in memory, stream run frames, and shape dashboard/export payloads around the existing single-label report builder
- Help-manifest slice: `src/shared/contracts/help.ts` plus `src/shared/help-fixture.ts` now define the typed tutorial/help contract and deterministic English manifest, `GET /api/help/manifest` serves that manifest from Express, and `src/client/help-runtime.ts` hydrates the approved help UI with a fixture fallback when the route is unavailable
- Results contract: `VerificationReport` now carries verdict/counts/extraction-quality state, regular comparison evidence, warning sub-checks plus diff segments, and cross-field checks in one shared schema
- Batch UI runtime: `src/client/batch-runtime.ts` maps live batch API payloads into the frozen batch upload, processing, dashboard, and drill-in view models without changing the approved UI composition
- Planned help architecture: future guided-review and contextual-help behavior should be delivered from typed, deterministic manifests and stateless server routes rather than persisted onboarding state

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
- Latency instrumentation must stay privacy-safe: no raw prompt/input logging, no raw filenames, and no durable timing artifacts that contain user content
- Low-confidence visual judgments downgrade to `review`
- Workflow and eval foundations gate later story pickup; once those are clear, ready approved `TTB-1xx` handoffs are preferred before later blocking `TTB-2xx+` Codex work
