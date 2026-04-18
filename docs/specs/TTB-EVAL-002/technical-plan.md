# Technical Plan

## Scope

Add a cost-optimized, eval-only Gemini Batch runner for the approved live extraction corpus while preserving the existing fixture-backed route gate.

## Modules and files

- `scripts/run-gemini-batch-extraction-benchmark.ts`
  - CLI entrypoint
  - loads repo-local env
  - resolves allowed corpus manifests
  - submits/polls/deletes Gemini Batch jobs
  - writes result artifacts under `evals/results/`
- `scripts/gemini-batch-extraction.ts`
  - pure helpers for:
    - corpus loading
    - request assembly
    - inline-size estimation
    - batch response parsing
    - aggregate metric calculation
- `scripts/gemini-batch-extraction.test.ts`
  - RED/GREEN coverage for helper seams
- `docs/specs/TTB-EVAL-002/*`
  - packet and privacy notes
- `evals/README.md`
  - tooling boundary update
- `evals/results/README.md`
  - result-artifact naming/usage note for Gemini Batch runs

## Reused contracts and exemplars

- Reuse `buildGeminiReviewExtractionRequest()` from `src/server/gemini-review-extractor.ts` for prompt/config parity.
- Reuse `reviewExtractionModelOutputSchema` and `normalizeReviewExtractionModelOutput()` from `src/server/review-extraction-model-output.ts`.
- Mirror metric semantics from `scripts/run-cola-cloud-extraction-benchmark.ts`.
- Keep corpus metadata aligned with `scripts/eval-corpus-types.ts`.

## Data flow

1. Load an allowed live corpus manifest.
2. Read each checked-in asset into a `NormalizedReviewIntake`-compatible object with expected fields.
3. Build Gemini extraction requests via the existing request builder.
4. Convert those requests into Gemini Batch inline requests with per-case metadata.
5. Estimate serialized size and fail closed if the request would exceed the inline Batch limit.
6. Submit `ai.batches.create({ model, src: inlineRequests })`.
7. Poll `ai.batches.get()` until completion.
8. Parse inline responses per case:
   - job error -> case error
   - malformed or schema-invalid output -> parse error
   - valid output -> normalized extraction result
9. Compute field metrics and write a local JSON artifact.
10. Optionally delete the completed batch job.

## Risks and fallback

- Risk: inline Batch request grows beyond API limits as the corpus expands.
  - Fallback: fail with an explicit message and keep file-mode out of scope for this story.
- Risk: helper code drifts from the runtime extractor request shape.
  - Fallback: import the existing request builder and schema normalizer directly.
- Risk: engineers mistake this for the canonical gate.
  - Fallback: reinforce the split in `evals/README.md` and packet docs.

## Testing strategy

- unit:
  - request assembly preserves per-case metadata and uses inline image parts
  - size guard trips above the configured limit
  - batch response parsing maps success, request-local error, malformed JSON, and schema failure correctly
- integration:
  - no live provider run required for default test suite
- contract:
  - request builder must remain aligned to the existing Gemini extractor output schema
- manual:
  - one opt-in dry run against the approved corpus when `GEMINI_API_KEY` is present
