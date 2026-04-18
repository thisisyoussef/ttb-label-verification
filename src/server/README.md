# src/server

The TTB label verification API. Express routes on top of a pipeline that runs OCR + warning OCV + VLM extraction in parallel, reconciles the reads per field, runs deterministic TTB rules, and returns a `VerificationReport`.

See [`../../README.md`](../../README.md) for the pipeline rationale and [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) for the full directory map.

## Subfolders

| Folder | What lives here |
|---|---|
| [`anchor/`](anchor/) | Per-field anchor-track — runs Tesseract TSV on the full label and checks whether applicant-declared values are present. Used to upgrade `review → pass`. |
| [`batch/`](batch/) | Batch-mode CSV + image upload, filename matching, session state, per-label streaming. |
| [`judgment/`](judgment/) | `judgeBrandName`, `judgeClassType`, `judgeAlcoholContent`, etc. — per-field judge functions with CFR citations, plus the weighted verdict rollup (`judgment-scoring.ts`) and the one-directional LLM uncertainty resolver client. |
| [`warning/`](warning/) | 27 CFR 16.21 / 16.22 government warning validator. Canonical text diff, sub-checks, OCR cross-check, OCV on the cropped region, 2-of-3 vote across VLM + OCV + OCR. |
| [`taxonomy/`](taxonomy/) | Lookup tables used by judgment rules (grape varietals, geography, address abbreviations, class-type aliases). |
| [`testing/`](testing/) | Reusable test fixtures + helpers. |

## Flat files (by area)

### Entry point + HTTP surface

| File | Purpose |
|---|---|
| `index.ts` | Express app factory. Composes routes + boot warmup. |
| `index.test-helpers.ts` | Shared test setup for the HTTP tests. |
| `register-app-routes.ts` | Top-level route registration. |
| `register-review-routes.ts` | `/api/review`, `/api/review/extraction`, `/api/review/warning`, `/api/review/stream`. |
| `register-batch-routes.ts` | `/api/batch/*` session endpoints. |
| `register-eval-routes.ts` | Eval-demo support routes (gated by env flag). |
| `request-handlers.ts` | Multer + error-translation middleware. |
| `server-events.ts` | Server-Sent-Event helpers used by the streaming review route. |
| `review-stream-route.ts` | SSE frame emitter for the streaming endpoint. |
| `review-route-support.ts` | Shared helpers across the review routes. |
| `boot-warmup.ts` | On-boot checks (Sharp available, Tesseract reachable, Ollama reachable). |

### Extractors (per-provider VLM clients)

Each one returns a `ReviewExtraction`. They're swapped via `AI_PROVIDER` and `AI_EXTRACTION_MODE_*`.

| File | Provider |
|---|---|
| `gemini-review-extractor.ts` | Google Gemini (cloud path) |
| `openai-review-extractor.ts` | OpenAI Responses API |
| `ollama-vlm-review-extractor.ts` | Ollama VLM (local path) |
| `local-llm-review-extractor.ts` | Generic local-LLM path |
| `transformers-review-extractor.ts` | In-browser / in-process Transformers.js path |
| `transformers-inference-worker.ts` | Worker thread for the Transformers.js path |
| `transformers-model-loader.ts` | Model-weight caching for Transformers.js |
| `review-extractor-factory.ts` | Picks the right extractor for the current env |
| `review-extractor-guardrails.ts` | Per-field safety net (no-text detection, URL-in-address scrub, etc.) |

### Extraction reconciler (per-field winner selection)

| File | Purpose |
|---|---|
| `extraction-merge.ts` | Main reconciler: VLM + OCR + region overrides → final per-field values |
| `extraction-ocr-reconciler.ts` | OCR-first normalization for numeric / regulatory-exact fields |
| `extraction-cache.ts` | Per-image-hash cache to skip redundant extractor runs |
| `parallel-extraction.ts` | Parallel VLM + OCR fanout helper |
| `split-extraction.ts` | Alternate extraction strategy (split per-field prompts) |
| `partial-json-field-scanner.ts` | Streaming-JSON field scanner for SSE responses |
| `review-prompt-policy.ts` | Prompt policy resolver per provider / field set |
| `review-extraction.ts` | Main extraction entrypoint + `ReviewExtraction` contract glue |
| `review-extraction-model-output.ts` | Raw-model-output schema + parser |

### OCR + image pipeline

| File | Purpose |
|---|---|
| `ocr-prepass.ts` | Full-image Tesseract read, ~500ms |
| `ocr-field-extractor.ts` | Field-boundary-aware OCR extraction helper |
| `ocr-image-preprocessing.ts` | Sharp pipelines (rotate, enhance, upscale) before OCR |
| `pdf-label-converter.ts` | PDF → PNG conversion for PDF-uploaded labels |
| `vlm-region-detector.ts` | Optional region-detection pass (opt-in, regressed on our corpus) |

### Pipeline orchestration

| File | Purpose |
|---|---|
| `llm-trace.ts` | Top-level pipeline orchestrator (parallel OCR + OCV + VLM, merge, judge, warning, report) |
| `llm-trace-stages.ts` | Stage implementations: tracedReviewExtraction, tracedWarningValidation, tracedReviewReport |
| `llm-trace-support.ts` | Stage-timing + tracing annotations |
| `review-surface-judgment.ts` | Field-judgment dispatcher used by the report builder |
| `review-fallback-executor.ts` | Provider-failure fallback chain |
| `review-provider-registry.ts` | Lookup for available providers by env |
| `review-provider-failure.ts` | Structured failure types surfaced to clients |
| `review-latency.ts` | Latency budget enforcement (5s public target) |

### Report builder

| File | Purpose |
|---|---|
| `review-report.ts` | End-to-end `VerificationReport` builder — the pipeline's final assembly point |
| `review-report-helpers.ts` | Field-spec table + shared rollup helpers |
| `review-report-field-checks.ts` | Per-field check generation with anchor-merge upgrades |
| `review-report-cross-field.ts` | Cross-field checks (varietal total, spirits co-location, etc.) |
| `review-intake.ts` | Normalize the intake payload (apply defaults, normalize strings, handle multi-image) |
| `spirits-colocation-check.ts` | VLM cross-field check for distilled-spirits "same field of vision" |

### LLM support

| File | Purpose |
|---|---|
| `llm-policy.ts` | Endpoint surface policy (which routes accept which providers) |
| `llm-resolver.ts` | One-directional review→pass uncertainty resolver |
| `ollama-judgment-llm-client.ts` | Local Ollama judgment client |
| `local-llm-inference.ts` | Shared local-LLM inference helpers |
| `langsmith-config.ts` | LangSmith tracing env resolution |

### Providers + config

| File | Purpose |
|---|---|
| `ai-provider-policy.ts` | Extraction-mode resolver (`cloud` / `local` / `auto`) |
| `load-local-env.ts` | `.env` loader with defaults — used by scripts and tests |

### Test-only

| File | Purpose |
|---|---|
| `synthetic-label-generator.ts` | Synthesize label images for e2e / regression tests |
| `synthetic-label-cache.ts` | Cache for generated synthetic labels |

## Suggested reading order

1. `review-report.ts` — see how the pipeline's output is assembled
2. `llm-trace.ts` — the parallel fanout + reconciliation orchestrator
3. `extraction-merge.ts` — the per-field-winner logic
4. `judgment/judgment-field-rules.ts` — the actual rules
5. `judgment/judgment-scoring.ts` — the verdict rollup
6. `warning/government-warning-validator.ts` — the 2-of-3 warning check
7. `register-review-routes.ts` — the public HTTP surface
