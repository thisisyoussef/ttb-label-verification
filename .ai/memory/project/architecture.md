# Architecture Memory

## Current application shape

- Frontend: Vite + React in `src/client`
- Backend: Express in `src/server`
- Shared boundary: Zod contracts in `src/shared/contracts`
- Harness: a lean checked-in contract centered on `AGENTS.md`, `CLAUDE.md`, SSOT, branch tracker, memory bank, and a small `.ai` workflow set, with direct branch work as the default
- UI flow harness: `STITCH_FLOW_MODE` supports `direct`, `automated`, and `manual`, with the legacy alias `claude-direct` mapped to `direct`
- Intake backend: `POST /api/review` validates one in-memory label file, accepts omitted `fields` for standalone reviews, normalizes intake in `src/server/review-intake.ts`, then runs extraction, warning validation, and deterministic report building before returning `VerificationReport`
- Runtime review wiring: `src/client/App.tsx` consumes the `VerificationReport` returned by `POST /api/review`, while `src/client/review-runtime.ts` decides when dev fixtures are allowed and falls back to a standalone seed report when application data is absent
- Extraction routing: `src/server/ai-provider-policy.ts` plus `src/server/review-extractor-factory.ts` resolve extraction as `cloud` vs `local`, then select the provider within that mode
- Prompt hardening: `src/server/review-prompt-policy.ts` resolves provider-agnostic prompt intent from route surface plus extraction mode, and `src/server/review-extractor-guardrails.ts` applies structural post-parse degradation
- Batch execution: `src/server/batch-session.ts` and related modules keep sessions in memory, stream run frames, and shape dashboard and export payloads around the existing single-label report builder
- Batch UI runtime: `src/client/batch-runtime.ts` maps live batch API payloads into the established upload, processing, dashboard, and drill-in view models
- Help-manifest slice: `src/shared/contracts/help.ts` plus `src/shared/help-fixture.ts` define the typed tutorial/help contract, `GET /api/help/manifest` serves that manifest, and `src/client/help-runtime.ts` hydrates the approved help UI with a fixture fallback when needed

## Core execution model

- The UI consumes typed review payloads and should not contain compliance logic.
- The server owns model orchestration and deterministic validators.
- Final compliance outcomes come from deterministic checks over structured extraction, not from a single model verdict.
- Optional reviewer guidance should come from typed, deterministic manifests and stateless routes, never from persisted onboarding state.

## Guardrails

- No persistence of uploaded labels, application data, or review results
- No persistence of batch session data beyond in-memory session life
- OpenAI Responses API only for new model work
- `store: false` on every request
- Gemini integrations stay inline-only with logging and data-sharing disabled; no Files API or other durable provider-managed upload surface
- Explicit local-mode selection stays local-only; no silent cloud escape hatch once the user picks `local`
- Latency instrumentation stays privacy-safe: no raw prompt or input logging, no raw filenames, and no durable timing artifacts that contain user content
- Low-confidence visual judgments downgrade to `review`
