# Architecture

A map of where things live. The `README.md` covers the _why_ of the pipeline (OCR + OCV + VLM reconciliation, deterministic rules, LLM as uncertainty resolver). This file is a walkthrough of the _directory layout_ for a first-time reader.

## Top level

```
ttb-label-verification/
├── src/                  All TypeScript source
│   ├── client/           React 19 reviewer UI
│   ├── server/           Express API, pipeline, rule engine
│   └── shared/           Zod contracts + helpers used by both
├── scripts/              CLI utilities: eval runners, fixture builders, git gates
├── evals/                Real COLA-approved label fixtures + golden harness
├── docs/                 Product spec, process docs, reference material
│   ├── assets/           Screenshots referenced by READMEs / docs
│   ├── backlog/          Legacy handoff packets (historical context)
│   ├── design/           Design notes per story
│   ├── evals/            Checked-in eval run logs
│   ├── process/          Operating contract: git hygiene, branch tracker, etc.
│   ├── qa/               QA notes per story
│   ├── reference/        Requirements map, environment audits, judgment guidance
│   └── specs/            Product spec + story packets
├── public/               Static assets served by Vite
├── .ai/                  Memory bank + workspace index for agents
├── .github/              CI workflows
├── .githooks/            Repo-managed git hooks (wire in with `npm run hooks:install`)
├── AGENTS.md             Operating contract for Claude / Codex
├── CLAUDE.md             Claude-specific addendum to AGENTS.md
├── CONTRIBUTING.md       How to start contributing (humans + agents)
├── README.md             Pipeline architecture + measured accuracy
└── ARCHITECTURE.md       This file
```

## The request pipeline, by file

A single label review flows through the server in four stages. The README diagram shows the data flow; below is the corresponding module map.

```
Request  →  Intake + guardrails     →  Extraction reconciler  →  Field judgments     →  Verdict rollup  →  Response
             src/server/review-intake  src/server/extraction-merge  src/server/judgment-*   src/server/judgment-scoring
             src/server/review-extractor-guardrails                 src/server/review-report
```

Three readers fire in parallel before that, each in its own module:

| Reader | Path | Purpose |
|---|---|---|
| Tesseract OCR prepass | `src/server/ocr-prepass.ts` | Full-image text, ~500ms |
| Warning region OCV | `src/server/warning-ocr-cross-check.ts` | Cropped warning re-read |
| Gemini / Ollama VLM | `src/server/gemini-review-extractor.ts`, `src/server/ollama-vlm-review-extractor.ts` | Schema-constrained JSON |

The reconciler then picks per-field winners in `src/server/extraction-merge.ts` (and the helper `extraction-ocr-reconciler.ts`).

## src/server by domain

The server is ~130 flat files today. They cluster into these domains:

| Domain | File prefix | What it does |
|---|---|---|
| **Extractors** | `gemini-*`, `openai-*`, `transformers-*`, `ollama-*`, `local-llm-review-extractor*` | Provider-specific VLM clients that return a `ReviewExtraction` |
| **Extraction reconciler** | `extraction-merge*`, `extraction-ocr-reconciler*`, `extraction-cache*`, `parallel-extraction*`, `split-extraction*` | Merge VLM + OCR reads per field, cache by image hash |
| **OCR** | `ocr-*`, `pdf-label-converter*` | Tesseract prepass, image preprocessing, PDF → image conversion |
| **Government warning** | `government-warning-*`, `warning-ocr-cross-check*` | Canonical 27 CFR 16.21/16.22 validator, 2-of-3 vote, sub-checks |
| **Field judgment** | `judgment-*` | One `judgeX` per field (brand, class, ABV, address, etc.), weighted verdict rollup |
| **Anchor track** | `anchor-*` | Per-field anchoring signals that can upgrade review → pass |
| **Review report** | `review-report*`, `review-intake*`, `review-prompt-policy*`, `review-extraction*`, `review-extractor-guardrails*`, `review-*` | End-to-end report builder, intake normalization, prompt policy, fallbacks |
| **LLM uncertainty resolver** | `llm-resolver*`, `llm-*`, `langsmith-*`, `judgment-llm-client-factory*` | One-directional review → pass resolver, tracing, provider routing |
| **Batch mode** | `batch-*`, `register-batch-routes*` | Multi-label CSV + image uploads, matching, session state |
| **Routes / Express** | `index.*`, `register-*`, `request-handlers*`, `server-events*`, `help-routes*`, `review-stream-route*` | HTTP surface |
| **Taxonomy** | `taxonomy/` | Lookup tables shared by judgment rules |
| **Testing helpers** | `testing/`, `synthetic-label-*`, `spirits-colocation-check*` | Fixtures + helpers reused across tests |
| **Infra** | `ai-provider-policy*`, `boot-warmup*`, `load-local-env*`, `partial-json-field-scanner*`, `review-latency*`, `review-provider-*`, `review-fallback-executor*` | Provider routing, bootstrap, parsing safety |

The most load-bearing files (read these first if you're orienting):

1. `src/server/index.ts` — Express entry, route registration
2. `src/server/review-report.ts` — Pipeline orchestrator, final `VerificationReport` builder
3. `src/server/extraction-merge.ts` — Per-field winner selection from the parallel reads
4. `src/server/judgment-field-rules.ts` — `judgeBrandName`, `judgeClassType`, `judgeAlcoholContent`, etc.
5. `src/server/judgment-scoring.ts` — Verdict rollup + safety gates
6. `src/server/llm-resolver.ts` — LLM uncertainty resolver (one-directional)
7. `src/server/government-warning-validator.ts` — 27 CFR warning check

## src/client by area

The client is ~135 flat files. They cluster like this:

| Area | File prefix | What it does |
|---|---|---|
| **Single-label review** | `Results*`, `VerdictBanner*`, `FieldRow*`, `StatusBadge*`, `FieldEvidence*`, `CrossFieldChecks*`, `NoTextState*`, `ResultsPinnedColumn*`, `reviewDisplayAdapter*` | Post-submit results UI; the reviewer's primary surface |
| **Intake** | `Intake*`, `IntakeFormControls*`, `BeverageTypeField*`, `VarietalEditor*` | The form the reviewer fills before submission |
| **Batch mode** | `Batch*`, `MatchingReview*`, `appBatchState*`, `batchTypes*`, `batchWorkflow*`, `batchDashboard*` | Multi-label upload + matching + drill-in shell |
| **Auth / shell** | `App*`, `AppShell*`, `AuthScreen*`, `BackBreadcrumb*` | Top-level chrome |
| **Guided tour** | `GuidedTour*`, `guided-tour-*`, `help-tour-runtime*` | First-run walkthrough |
| **Help system** | `Help*`, `help-runtime*`, `InfoAnchor*` | Inline tooltips + help drawer |
| **Eval demo** | `EvalDemo*` | Recorded-corpus demo for onboarding |
| **Toolbench** | `toolbench/`, `toolbenchRouteState*` | Internal diagnostics surface |
| **Streaming + runtime** | `review-runtime*`, `singleReviewFlow*`, `useStreamingReview*`, `useRefineReview*`, `mergeRefinedReport*`, `reviewFailureMessage*` | Client-side pipeline driver: SSE stream, row-level refine, failure copy |
| **Shared UI primitives** | `DropZone*`, `ConfidenceMeter*`, `HelpTooltip*`, `ImagePreviewOverlay*`, `LabelImageGallery*`, `types*` | Reusable pieces |
| **Display logic** | `reviewDisplayAdapter*`, `resolveCheckBadge*`, `resultScenario*`, `dynamic-review-copy*` (shared) | User-facing verdict + copy adapter (engine verdict → display verdict) |

The most load-bearing files:

1. `src/client/App.tsx` + `src/client/AppShell.tsx` — top-level routing
2. `src/client/Results.tsx` — primary post-submit surface
3. `src/client/reviewDisplayAdapter.ts` — engine verdict → user-facing copy; the single seam for UX
4. `src/client/review-runtime.ts` + `src/client/useStreamingReview.ts` — client-side pipeline driver
5. `src/client/BatchDashboard.tsx` — batch-mode entry

## src/shared

Zod contracts and helpers used by both client and server. Import the contracts from `src/shared/contracts/review.ts` (the barrel) rather than internal files.

- `contracts/review-base.ts` — canonical schemas (`verificationReportSchema`, `checkReviewSchema`, etc.) and types
- `contracts/review-seed.ts` — a seed report used by tests and the client's empty state
- `contracts/review.ts` — barrel re-export; what server + client should import
- `contracts/batch.ts`, `contracts/help.ts` — batch + help surface contracts
- `dynamic-review-copy.ts` — plain-language severity summarizer shared across surfaces
- `batch-file-meta.ts` — shared filename parsing for batch uploads

## scripts

CLI utilities, grouped into subfolders by purpose:

```
scripts/
├── evals/      Eval runners + benchmarks (remote-eval, judgment-variations, gemini-batch-*)
├── fixtures/   Fixture + asset generators (generate-*, convert-*-to-pdf, fetch-cola-*)
├── git-hooks/  Commit/push gates, story branch tracker (git-story-gate, branch-tracker, check-source-size)
├── stitch/     Stitch design-tool integration (stitch-auth, stitch-mcp-proxy, stitch-story)
└── dev/        Local dev utilities + smokes (bootstrap-local-env, cache-local-model, *-smoke)
```

See [`scripts/README.md`](scripts/README.md) for a description per script.

## Tests

Tests live next to the code they test, with a `.test.ts` / `.test.tsx` suffix. No separate `__tests__` directories.

End-to-end pipeline tests:
- `src/server/review-pipeline.e2e.test.ts` — full pipeline with mocked VLM
- `src/server/index.*.test.ts` — HTTP boundary tests
- `src/server/anchor-field-track.e2e.test.ts` — anchor track against real extraction

Golden eval harness (uses real VLM, gated on `GEMINI_API_KEY`):
- `evals/llm/**` + `ls.vitest.config.ts` — run via `npm run eval:llm`

## Further reading

- `README.md` — architecture rationale + measured accuracy
- `AGENTS.md` — operating contract for agents
- `CONTRIBUTING.md` — onboarding for new contributors
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` — current work state
- `docs/specs/FULL_PRODUCT_SPEC.md` — product shape
- `docs/reference/submission-baseline.md` — assumptions + evidence map
