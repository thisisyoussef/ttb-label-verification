# scripts/

CLI utilities used by npm scripts, git hooks, evals, and local diagnostics. Grouped into five subfolders so you can find a script by what it does, not by naming convention.

```
scripts/
├── evals/      Run the corpus, benchmark providers, compare experiments
├── fixtures/   Download + convert + regenerate label fixtures
├── git-hooks/  Commit, push, and publish gates + story branch tracker
├── stitch/     Stitch design-tool integration (screen generation, MCP proxy)
└── dev/        Local dev utilities, bootstrap, smokes, debug probes
```

## evals/

Run slices of the golden corpus or offline synthetic harnesses.

| File | Entry via | What it does |
|---|---|---|
| `remote-eval.ts` | `npx tsx` | Run the 28-label `cola-cloud-all` corpus against any running API (`BASE_URL=...`) |
| `fast-eval.ts` | `npx tsx` | Launch the API in-process and run a slice end-to-end |
| `judgment-variations.ts` | `npx tsx` | 859 synthetic perturbations per field judge — offline rule correctness check |
| `validate-evals.ts` | `npm run evals:validate` | Manifest integrity between golden + live corpora |
| `run-cola-cloud-extraction-benchmark.ts` | `npx tsx` | Extraction-only benchmark on the cloud corpus |
| `run-cola-cloud-batch-fixtures.ts` / `-local.ts` | `npx tsx` | Batch-mode replay against local / cloud fixtures |
| `run-gemini-batch-extraction-benchmark.ts` | `npm run eval:golden:batch` | Gemini Batch API path (opt-in, TTB-EVAL-002) |
| `run-30-experiments.ts` / `.sh` | `npx tsx` / `bash` | Sweep across judgment variations |
| `gemini-batch-extraction.ts` | lib | Shared helpers for the Gemini Batch runner |
| `experiment-runner.ts` | lib | Shared harness for sweeps |
| `anchor-track-eval.ts`, `anchor-all-fields-experiment.ts` | `npx tsx` | Anchor-field track evals |
| `batch-pipelining-bench.ts` | `npx tsx` | Batch-mode throughput benchmark |
| `compare-pdf-vs-image-results.ts` | `npx tsx` | Compare PDF and raster extraction results |
| `eval-batch-metrics.ts`, `eval-corpus-types.ts` | lib | Shared metrics + types |
| `run-local-llm-eval.ts` | `npx tsx` | Run the corpus against the Ollama / local-llm path |
| `stage-timings.ts` | `npx tsx` | Per-stage latency breakdown |
| `*.test.ts` | `npm test` | Unit tests for these helpers |

## fixtures/

Generate or convert the fixture assets under `evals/labels/` and `evals/live-labels/`.

| File | What it does |
|---|---|
| `fetch-cola-cloud-labels.ts` | Download COLA-approved labels + write the live manifest |
| `generate-live-label-assets.ts` (`npm run generate:label-assets`) | Render synthetic label assets the UI demo uses |
| `generate-cola-cloud-batch-fixtures.ts` | Build the batch-mode fixtures from the cloud corpus |
| `generate-supplemental-negative-labels.ts` | Synthesize negative/illegit label variants |
| `convert-labels-to-pdf.ts`, `convert-batch-fixtures-to-pdf.ts` | Raster → PDF conversion for PDF ingestion tests |
| `trim-pdf-manifest-to-all.ts` | Post-processing helper for the PDF manifest |

## git-hooks/

Called from `.githooks/pre-commit`, `.githooks/pre-push`, `.githooks/commit-msg` via the npm scripts `gate:commit`, `gate:push`, `gate:commit-msg`.

| File | What it does |
|---|---|
| `install-git-hooks.ts` (`npm run hooks:install`) | Sets `core.hooksPath=.githooks` in the local repo |
| `git-story-gate.ts` (`npm run gate:{commit,push,publish}`) | Branch naming + tracker entry checks; blocks direct work on `main` |
| `git-commit-msg-gate.ts` (`npm run gate:commit-msg`) | Conventional-commit subject + story-id enforcement |
| `check-source-size.ts` + `check-source-size-lib.ts` (`npm run guard:source-size`) | 500-line cap per source file, baselined in `source-size-baseline.json` |
| `story-branch.ts` + `story-branch-lib.ts` (`npm run story:branch`) | Open, update, close story branches; integrates with the branch tracker |
| `branch-tracker.ts` | Library for reading + mutating `docs/process/BRANCH_TRACKER.md` |
| `source-size-baseline.json` | Frozen line counts for inherited oversized files |
| `*.test.ts` | Unit tests for the gates and libraries |

## stitch/

Integration with Stitch, Google's design-tool MCP server, for flow-authoring stories. Unused in production; see `docs/process/STITCH_AUTOMATION.md`.

| File | What it does |
|---|---|
| `stitch-auth.ts` | Credential resolution |
| `stitch-project.ts` | Project + asset helpers |
| `stitch-flow-mode.ts` | Flow-mode screen generation |
| `stitch-generate-screen.ts` | Per-screen generator |
| `stitch-mcp-proxy.ts` (`npm run stitch:mcp-proxy`) | Local MCP relay to Stitch |
| `stitch-smoke-test.ts` (`npm run stitch:smoke`) | End-to-end smoke |
| `stitch-story.ts` (`npm run stitch:story`) | Story-driven screen generation |
| `stitch-story-helpers.ts` | Shared story helpers |

## dev/

Local diagnostics and bootstrap. Use these when something is wrong in a dev loop.

| File | What it does |
|---|---|
| `bootstrap-local-env.ts` (`npm run env:bootstrap`) | Prime `.env` from `.env.example` + check required keys |
| `bootstrap-github-repo.sh` | First-time GitHub repo setup |
| `cache-local-model.ts` (`npm run model:cache`) | Pre-download the Transformers.js model weights |
| `check-provider-resolution.ts` | Print which provider the current env selects |
| `debug-warning-fail.ts` | Single-label warning-check probe |
| `langsmith-smoke-test.ts` (`npm run langsmith:smoke`) | Verify LangSmith tracing is wired |
| `ollama-vlm-smoke.ts`, `smoke-local-llm.ts`, `verify-warning-smoke.ts` | Smokes for the local VLM + warning validator paths |
| `test-colocation.ts`, `test-local-review.ts`, `test-ocr-pipeline.ts` | Ad-hoc experiments kept for repeatability |
| `trace-extraction-pollution.ts` | Detect OCR → VLM pollution on the cloud path |

## Running a script directly

Most scripts are `npx tsx <path>`-runnable. Example:

```bash
# from the repo root
BASE_URL=http://127.0.0.1:8787 npx tsx scripts/evals/remote-eval.ts --slice=cola-cloud-all
```

For scripts that depend on server code, make sure the API is running (`npm run dev:api`).
