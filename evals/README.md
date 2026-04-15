# Evals

This project treats evaluation as part of the product contract.

## Canonical datasets

- `golden/manifest.json` is the canonical full golden eval set.
- `labels/manifest.json` is the live image-backed core-six subset used for default demos, seeded UI, and the first live extraction slice.
- `labels/latency-twenty.manifest.json` is the checked-in synthetic 20-case live image-backed latency slice used for Gemini hot-path benchmarking.

## Required baseline

The core-six baseline remains:

1. perfect spirit label
2. spirit label with warning errors
3. spirit label with cosmetic brand mismatch
4. wine label missing appellation
5. beer label with forbidden ABV abbreviation
6. deliberately low-quality image

The full golden set extends this baseline with beverage-specific, format, comparison, cross-field, warning-edge, standalone, batch, and error-handling cases.

## Applicability model

Run only the smallest applicable slice:

- `core-six` for default live single-label regression, demo, and seeded UI
- `latency-twenty` for broader live Gemini latency and hot-path regression against the checked-in 20-case synthetic slice
- `beverage-type-coverage` for beverage-specific rules
- `format-compliance` for net contents, ABV, and proof formatting
- `deterministic-comparison` for string/numeric comparison behavior without real media
- `cross-field-dependencies` for multi-field logic
- `government-warning-edge-cases` for warning validator work
- `standalone-mode` for no-application-data flows
- `batch-processing` for batch intake, triage, and export
- `error-handling` for upload and unreadable-image behavior
- `endpoint-review` for the integrated `/api/review` route
- `endpoint-extraction` for `/api/review/extraction`
- `endpoint-warning` for `/api/review/warning`
- `endpoint-batch` for `/api/batch/run` and `/api/batch/retry`

For endpoint slices, also record the extraction mode used. Today every checked-in endpoint eval run is `cloud`. Do not plan local counterparts unless the archived `TTB-212` packet is explicitly revived later.

## Structure

- `golden/manifest.json` — canonical full golden set and slice catalog
- `golden/README.md` — how to pick the smallest applicable slice
- `llm-endpoint-matrix.md` — route-aware LLM surface mapping
- `persona-scorecards.md` — user-promise scorecards for endpoint eval review
- `labels/manifest.json` — live image-backed core-six subset
- `labels/latency-twenty.manifest.json` — checked-in synthetic 20-case live image-backed latency subset
- `labels/manifest.template.json` — shape reference for live image-backed subset files
- `labels/assets/` — expected live-eval filenames and any checked-in media for the live image-backed subsets
- `results/` — checked-in run logs for story-specific eval runs

## Rules

- If a story changes extraction, validators, recommendation logic, evidence payloads, or user-visible seeded scenario claims, record an eval run.
- If a story changes prompt, model choice, tool-calling, or agentic orchestration, pair the eval run with a LangSmith trace review and record the winning traces.
- Use `npm run eval:golden` for the fixture-backed endpoint gate. It validates manifests and runs the LangSmith-backed eval suite with test tracking on only when the env enables it.
- If a story exposes a new important failure mode, update `golden/manifest.json` or create a backlog item to do so.
- Capture measured latency with each eval run for single-label critical-path work.
- The endpoint-aware golden runner is fixture-backed on purpose. It complements, rather than replaces, any live image-backed eval slice required by a specific story.
- Missing binaries under `labels/assets/` are only a blocker when the active story actually requires a live extraction or live eval run against one of the checked-in live subsets.
