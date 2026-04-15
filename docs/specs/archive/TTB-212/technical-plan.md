# Technical Plan

## Scope

Add a fully local label-extraction path on top of the new extraction-mode router so the app can run the same deterministic validation pipeline without outbound cloud model calls.

## Current status

This plan is deferred. The user explicitly scrapped the in-progress local-model implementation on 2026-04-15 and asked to revisit it later. Treat the modules below as planning notes only until the story is resumed.

## Planned modules and files

- `src/server/ai-provider-policy.ts`
  - extend extraction-mode resolution to support `local`
- `src/server/ollama-review-extractor.ts`
  - local Ollama adapter for image-first extraction and structured-output normalization
- `src/server/ollama-review-extractor.test.ts`
  - request-building, normalization, and local-failure coverage
- `src/server/review-extractor-factory.ts`
  - instantiate the local extractor when `local` mode is selected
- `src/server/index.ts`
  - pass the selected extraction mode through the shared route surfaces
- `src/server/batch-session.ts`
  - inherit the same local-mode extractor for item processing and retry
- `scripts/bootstrap-local-env.ts`
  - add Ollama host/model env slots
- `README.md`
  - document local-mode setup, limitations, and deployment framing

## Local-mode design

- Mode split:
  - `cloud` -> provider order stays inside the cloud boundary
  - `local` -> local-only execution, no automatic cloud escape hatch
- Default local engine:
  - Ollama local API
  - model target intentionally undecided until the user resumes the story
- Output contract:
  - identical `ReviewExtraction` schema
  - mode/provider provenance stays available in traces and eval logs; only add API-surface metadata if the contract story later requires it

## PDF strategy

Local vision support for PDFs is less certain than the current cloud path. The implementation should evaluate an in-memory PDF-to-image compatibility shim first. If that path cannot be made portable within the prototype constraints, local mode must return an explicit bounded unsupported error for PDFs and the packet must document the gap.

## Confidence strategy

Local mode is expected to be weaker on formatting and layout reasoning. The adapter should therefore bias toward:

- `uncertain` status on warning visual signals when evidence is weak
- lower confidence scores instead of assertive `yes` or `no`
- preserving text extraction when text is reliable, even if visual qualifiers degrade

That keeps the deterministic validator pipeline honest: more `review`, fewer false `pass` or false `fail`.

## Risks and fallback

- Risk: Ollama integration works for images but not PDFs.
  - Fallback: keep the PDF gap explicit and bounded; do not fake parity.
- Risk: local mode is too slow on cold start.
  - Fallback: measure warm and cold separately, document warm-up behavior, and keep local mode opt-in.
- Risk: local mode silently drifts into cloud fallback when errors occur.
  - Fallback: keep mode as the top-level resolver and fail closed across mode boundaries.
- Risk: the eventual local vision model is unavailable or too heavy on target hardware.
  - Fallback: keep the model choice explicit and deferred until the packet records the exact capability tradeoffs and the degraded-confidence policy still prevents false certainty.

## Testing strategy

- unit:
  - local request building
  - failure classification
  - degraded-confidence normalization helpers
- contract:
  - route payload shape remains stable in local mode
- integration:
  - `/api/review`
  - `/api/review/extraction`
  - `/api/review/warning`
  - batch item processing and retry
- eval and traces:
  - compare cloud vs local on the approved fixture slice and record where local deliberately degrades
