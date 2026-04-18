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

The clearest four clusters are now subfolders; the rest stay flat at `src/server/` where the pipeline entry points are most visible. See [`src/server/README.md`](src/server/README.md) for the full per-file map.

```
src/server/
├── anchor/     Per-field anchor-track (upgrade review → pass when applicant values are visibly on the label)
├── batch/      Batch-mode CSV + session state + matching
├── judgment/   Per-field judge functions + weighted verdict rollup + LLM resolver client
├── warning/    27 CFR government warning validator (canonical diff, sub-checks, OCV, 2-of-3 vote)
├── taxonomy/   Lookup tables (grape varietals, geography, address abbreviations, class-type aliases)
├── testing/    Reusable test fixtures + helpers
│
├── index.ts                 Express app factory
├── llm-trace.ts             Pipeline orchestrator (parallel OCR + OCV + VLM)
├── review-report.ts         End-to-end VerificationReport builder
├── extraction-merge.ts      Per-field winner selection across VLM + OCR + region overrides
├── gemini-review-extractor.ts        Cloud VLM path
├── ollama-vlm-review-extractor.ts    Local VLM path
├── llm-resolver.ts          One-directional review → pass uncertainty resolver
├── register-review-routes.ts         POST /api/review[*] surface
├── register-batch-routes.ts          POST /api/batch[*] surface
└── …                        (other extractors, OCR helpers, support utilities)
```

The most load-bearing files (read these first if you're orienting):

1. `src/server/index.ts` — Express entry, route registration
2. `src/server/review-report.ts` — Pipeline orchestrator, final `VerificationReport` builder
3. `src/server/extraction-merge.ts` — Per-field winner selection from the parallel reads
4. `src/server/judgment/judgment-field-rules.ts` — `judgeBrandName`, `judgeClassType`, `judgeAlcoholContent`, etc.
5. `src/server/judgment/judgment-scoring.ts` — Verdict rollup + safety gates
6. `src/server/llm-resolver.ts` — LLM uncertainty resolver (one-directional)
7. `src/server/warning/government-warning-validator.ts` — 27 CFR warning check

## src/client by area

Four domain clusters are subfolders; the reviewer's primary surface (Results, VerdictBanner, FieldRow, reviewDisplayAdapter) stays at `src/client/` root where it's most visible. See [`src/client/README.md`](src/client/README.md) for the full per-file map.

```
src/client/
├── auth/       AuthScreen + client-only auth state + session timeout
├── batch/      Batch dashboard + upload + matching + drill-in (26 files)
├── eval/       EvalDemo surface for recorded-corpus demos
├── tour/       First-run guided tour + help-tour orchestration
├── toolbench/  Internal diagnostics UI
│
├── App.tsx                    Top-level routing
├── AppShell.tsx               Persistent chrome
├── Results.tsx                Primary post-submit surface
├── VerdictBanner.tsx          approve / review / recommend-reject banner
├── FieldRow.tsx               Per-check row with evidence
├── reviewDisplayAdapter.ts    Engine verdict → user-facing copy (the single UX seam)
├── review-runtime.ts          Review-run orchestrator
├── useStreamingReview.ts      SSE frame consumer
├── Intake.tsx                 Pre-submit form
├── HelpLauncher.tsx           Help drawer
└── …                          (processing views, scenario fixtures, shared primitives)
```

The most load-bearing files:

1. `src/client/App.tsx` + `src/client/AppShell.tsx` — top-level routing
2. `src/client/Results.tsx` — primary post-submit surface
3. `src/client/reviewDisplayAdapter.ts` — engine verdict → user-facing copy; the single seam for UX
4. `src/client/review-runtime.ts` + `src/client/useStreamingReview.ts` — client-side pipeline driver
5. `src/client/batch/BatchDashboard.tsx` — batch-mode entry

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
