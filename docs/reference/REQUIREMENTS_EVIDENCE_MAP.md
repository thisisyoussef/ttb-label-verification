# Requirements Evidence Map

This document maps every hard product constraint to its documentation section, code path, and demo path. It is the single artifact that proves each requirement is met, calls out measured results honestly, and names tradeoffs without hedging.

Last verified: 2026-04-15

---

## 1. No Persistence

**Requirement:** No uploaded label image, application input, or verification result may be persisted.

### Evidence

| Layer | Location | What it proves |
|---|---|---|
| Zod schema | `review-base.ts:252` | `noPersistence: z.literal(true)` on every verification report. The schema *rejects* any value other than `true` at parse time. |
| Zod schema | `review-base.ts:261` | `store: z.literal(false)` on the health response schema. |
| Zod schema | `review-batch.ts:214` | `noPersistence: z.literal(true)` on batch export payloads. |
| Health route | `register-app-routes.ts:37` | `store: false` emitted in every `/api/health` response. |
| Report builder | `review-report.ts:47,81` | `noPersistence: true` hardcoded in both no-extraction and normal report paths. |
| Batch session | `batch-session.ts:44` | `sessions = new Map<string, BatchSession>()` -- in-memory only. No database, no disk, no queue. |
| Batch export | `batch-session.ts:214` | `noPersistence: true` on every export payload. |
| OpenAI config type | `openai-review-extractor.ts:31` | `store: false` is a required field in the config type. |
| OpenAI runtime | `openai-review-extractor.ts:91` | `store: false` hardcoded when building the request. |
| OpenAI privacy gate | `openai-review-extractor.ts:74` | If `OPENAI_STORE` env is anything other than `'false'`, the adapter **refuses to initialize**. |
| Factory privacy gate | `review-extractor-factory.ts:448` | Returns `'privacy-boundary'` error if store constraint is violated. |
| Gemini adapter | `gemini-review-extractor.ts:123` | Uses `inlineData` with base64. No Files API, no `cachedContents`, no durable upload surface. |
| UI copy | `ResultsPinnedColumn.tsx:85` | "Nothing is stored. Inputs and results are discarded when you leave." |
| Guided help | `help-fixture.ts:89,124` | `anchorKey: 'no-persistence'` teaches the no-storage policy to reviewers. |
| LangSmith traces | `llm-trace.ts:116,134,160,251,258,306,312,365,372` | Every trace metadata block carries `noPersistence: true`. |
| Test: health | `index.test.ts:43` | `expect(payload.store).toBe(false)` |
| Test: report | `index.test.ts:101,130` | `expect(payload.noPersistence).toBe(true)` on standard and standalone paths. |
| Test: contract | `review.test.ts:57,202` | Asserts both `noPersistence` and `store: false` at the schema boundary. |
| Test: batch export | `review.test.ts:435` | `expect(exportPayload.noPersistence).toBe(true)` |

### Demo path

```
curl http://localhost:8787/api/health | jq '.store'
# Returns: false
```

Every `POST /api/review` response includes `noPersistence: true` in the payload.

### Tradeoff

Batch session data lives in a `Map<>` inside the Node process. A long-running process with many concurrent batch sessions can grow memory without bound. Acceptable for PoC; production would need session TTLs or memory caps.

---

## 2. Sub-5-Second Response Target

**Requirement:** Default cloud single-label review must stay within a 5-second end-to-end target.

### Evidence

| Layer | Location | What it proves |
|---|---|---|
| Internal constant | `review-base.ts:59` | `REVIEW_LATENCY_BUDGET_MS = 4000` (internal optimization target). |
| Schema enforcement | `review-base.ts:251` | `latencyBudgetMs: z.number().int().positive().max(REVIEW_LATENCY_BUDGET_MS)` -- the response cannot declare a budget above 4000. |
| Public contract | `FULL_PRODUCT_SPEC.md:21` | "keeping the public contract at `<= 5,000 ms`" |
| Gemini timeout | `gemini-review-extractor.ts:28` | `DEFAULT_GEMINI_TIMEOUT_MS = 5000` |
| Gemini tuning | `SINGLE_SOURCE_OF_TRUTH.md` | TTB-209 locked winning profile: `gemini-2.5-flash-lite`, raster `low`, PDF `medium`, `thinkingBudget=0`. |
| Latency observer | `review-latency.ts` (193 lines) | `ReviewLatencyCapture` class with stage-level timing: `intake-parse`, `provider-selection`, `request-assembly`, `provider-wait`, `fallback-handoff`, `deterministic-validation`, `report-shaping`. |
| Fallback budget gate | `review-latency.ts:4` | `REVIEW_MAX_RETRYABLE_FALLBACK_ELAPSED_MS = 550` -- fallback only attempted if primary fails within 550ms. |
| Latency corpus | `evals/labels/latency-twenty.manifest.json` | 20-case synthetic benchmark set for timing regression. |
| Test | `review.test.ts:58` | `expect(report.latencyBudgetMs).toBeLessThanOrEqual(4000)` |

### Demo path

Every `POST /api/review` response includes `latencyBudgetMs` in the payload. Stage-level timing is logged to the server console via `[ttb-latency]` JSON lines.

### Measured results

- Gemini flash-lite typical range: **1.5s -- 4.5s** end-to-end depending on image complexity and API load.
- Deterministic validation adds **< 50ms** after extraction.
- The tighter 4000ms internal target was not definitively proved across all conditions (TTB-209 finding). The public contract remains at 5000ms.

### Tradeoff

The 5-second budget is a monitoring contract, not a hard SLA. Real-world latency depends on Gemini API response time, which varies with load. The system monitors and reports per-request latency but cannot guarantee the target under API contention. The fallback path (OpenAI) adds ~1-3s if the primary path fails fast enough to attempt it.

---

## 3. Batch Support

**Requirement:** First-class batch workflows: upload many labels + CSV, confirm matching, watch progress, triage dashboard, drill-in, export.

### Evidence

| Layer | Location | What it proves |
|---|---|---|
| Batch contract | `review-batch.ts` | Typed schemas: `batchPreflightRequestSchema`, `batchMatchedPairSchema`, `batchAmbiguousSchema`, `batchStreamFrameSchema`, `batchDashboardResponseSchema`, `batchExportPayloadSchema`. |
| Batch cap | `review-batch.ts:16` | `BATCH_LABEL_CAP = 50` |
| CSV format | `review-batch.ts:17-38` | 13 supported headers, 5 required: `filename`, `brand_name`, `class_type`, `alcohol_content`, `net_contents`. |
| Session engine | `batch-session.ts` (354 lines) | `BatchSessionStore` with `createPreflight()`, `run()`, `retryRow()`, `getDashboard()`, `getExport()`. |
| Streaming progress | `batch-session.ts:93-157` | Real-time `onFrame` callbacks: `type: 'progress'` with `secondsRemainingEstimate`, `type: 'item'` per completed row. |
| Row retry | `batch-session.ts` | `retryRow()` reprocesses individual failed rows without rerunning the whole batch. |
| CSV parser | `batch-csv.ts` | Validates CSV against expected headers and row format. |
| Matching engine | `batch-matching.ts` | Filename-based and order-based matching with ambiguity detection. |
| Batch routes | `register-batch-routes.ts` | `POST /api/batch/preflight`, `POST /api/batch/start`, `POST /api/batch/retry`, `GET /api/batch/dashboard`, `GET /api/batch/export`. |
| UI: upload | `BatchUpload.tsx`, `BatchUploadDropZones.tsx`, `BatchUploadPanels.tsx` | Multi-image + CSV drag-and-drop intake. |
| UI: matching | `MatchingReview.tsx`, `MatchingReviewGroups.tsx` | Visual resolution for ambiguous image-to-row pairs. |
| UI: processing | `BatchProcessing.tsx`, `BatchProcessingSections.tsx` | Progress bar, per-row status, cancel button. |
| UI: dashboard | `BatchDashboard.tsx`, `BatchDashboardTable.tsx`, `BatchDashboardControls.tsx` | Triage table, filter controls, export. |
| UI: drill-in | `BatchDrillInShell.tsx` | Reuses single-label Results view for any row. |
| Test: routes | `batch-routes.test.ts` (417 lines) | Preflight, run, retry, dashboard, export integration tests. |
| Test: CSV | `batch-csv.test.ts` | Header validation, row parsing edge cases. |
| Test: matching | `batch-matching.test.ts` | Filename-based and order-based matching logic. |
| File count | `src/` | **67 files** touch batch functionality across client, server, shared, and tests. |

### Demo path

Batch tab in the AppShell: upload images + CSV, review matching, watch progress with streaming updates, triage dashboard, drill into any row (same evidence as single-label), export session results.

### Tradeoff

Batch cap is 50 labels per session, not Janet's full 200-300 peak-season volume. Each row makes a serial API call, so 50 labels at ~3-5s each means ~2.5-4 minutes per batch. Production-scale batches would need parallel extraction, queuing, and possibly chunked session management.

---

## 4. Government Warning Statement Strictness

**Requirement:** Exact-text and format checks for the government warning per 27 CFR 16.21 and 16.22.

### Evidence

| Layer | Location | What it proves |
|---|---|---|
| Canonical text | `review-base.ts:329-330` | `CANONICAL_GOVERNMENT_WARNING` -- the exact required text is a single hardcoded constant. |
| Validator | `government-warning-validator.ts` (432 lines) | Five sub-checks, each a pure function. |
| Diff engine | `government-warning-diff.ts` (287 lines) | Character-level diff producing segments: `match`, `missing`, `wrong-character`, `wrong-case`. |
| OCR cross-check | `warning-ocr-cross-check.ts` (176 lines) | Cross-validates extraction confidence against OCR signals. |
| Sub-check: present | `government-warning-validator.ts:99-119` | Missing text -> `fail` if extraction is reliable, `review` if low-confidence. |
| Sub-check: exact-text | `government-warning-validator.ts:122-164` | Character-level comparison after whitespace normalization. Mismatch -> `fail` (reliable) or `review` (uncertain). |
| Sub-check: uppercase-bold-heading | `government-warning-validator.ts:166-200` | Checks that "GOVERNMENT WARNING" prefix is uppercase and bold using visual signals from extraction. |
| Sub-check: continuous-paragraph | `government-warning-validator.ts` | Validates no prohibited line breaks within the warning text. |
| Sub-check: legibility | `government-warning-validator.ts` | Font size, contrast, readability assessment. |
| Status aggregation | `government-warning-validator.ts:71-73` | Any sub-check `fail` -> severity `blocker`. Any `review` -> severity `major`. |
| Confidence thresholds | `government-warning-validator.ts:20-21` | `WARNING_TEXT_CONFIDENCE_THRESHOLD = 0.8`, `WARNING_VISUAL_CONFIDENCE_THRESHOLD = 0.75`. |
| CFR citations | `government-warning-validator.ts:22-26` | `27 CFR 16.21`, `27 CFR 16.22`, `TTB health warning statement guidance`. |
| Contract: sub-check IDs | `review-base.ts:52-58` | `['present', 'exact-text', 'uppercase-bold-heading', 'continuous-paragraph', 'legibility']` |
| Contract: diff segments | `review-base.ts:61-66` | `'match' | 'missing' | 'wrong-character' | 'wrong-case'` |
| Eval scenario | `evals/labels/manifest.json:17-24` | `spirit-warning-errors`: title-case + punctuation defect -> `expectedRecommendation: "reject"`. |
| Test: low-confidence | `government-warning-validator.test.ts:278` | "keeps a low-confidence missing warning in review instead of hard-failing it" |
| Total warning code | 3 modules | **895 lines** dedicated to government warning validation. |

### Demo path

Single-label Results: expand the "Government warning" checklist row. See five sub-check rows, each with status, reason, and evidence. When text differs, character-level diff highlighting shows exact deviations.

### Tradeoff

Visual signal detection (bold, all-caps, same-field-of-vision) relies on the AI model's extraction. The validator treats uncertain visual claims as `review`, never silent `pass`. This means correctly-formatted labels may be flagged for human review when the model is unsure about typographic properties -- a deliberate false-positive bias that protects compliance.

---

## 5. Uncertain Judgments Default to `review`

**Requirement:** Uncertain visual judgments default to `review`, never silent `pass`.

### Evidence

| Location | Rule |
|---|---|
| `government-warning-validator.ts:115` | Missing warning + low confidence -> `review` (not `fail`). |
| `government-warning-validator.ts:148-153` | Exact text match + low confidence -> `review` (not `pass`). |
| `government-warning-validator.ts:159` | Text mismatch + low confidence -> `review` (not `fail`). |
| `government-warning-validator.ts:176-179` | Heading format uncertain -> `review`. |
| `government-warning-validator.test.ts:278` | Test: "keeps a low-confidence missing warning in review instead of hard-failing it". |
| `evals/labels/manifest.json:57-59` | `low-quality-image` scenario -> `expectedRecommendation: "review"`. |

### Design principle

The system has three possible errors: false positive (flag something correct), false negative (miss something wrong), and overconfident failure (hard-fail on uncertain evidence). The architecture treats false positives as the least harmful error in a compliance context and defaults to `review` whenever confidence is below threshold.

---

## 6. Deterministic Compliance Outcomes

**Requirement:** The model extracts and classifies. Final compliance outcomes come from deterministic logic and typed contracts.

### Architecture

The pipeline is a strict two-stage design:

1. **Stage 1: Model extraction.** Gemini or OpenAI extracts structured facts from the label image. The model never decides compliance.
2. **Stage 2: Deterministic validation.** Pure-function validators run on the extracted struct. Government warning text is compared character-by-character. Field values are compared against application data with typed tolerance rules. Beverage-specific rules are codified, not prompted.

| Validator family | Module |
|---|---|
| Government warning | `government-warning-validator.ts` |
| Warning diff | `government-warning-diff.ts` |
| OCR cross-check | `warning-ocr-cross-check.ts` |
| Field comparison | Via TTB-205 field comparison modules |
| Beverage rules | Via TTB-205 beverage-specific rule modules |
| Recommendation aggregation | `review-report.ts` |

Every compliance decision traces to a code path, not a model prompt.

---

## 7. Eval Coverage: Core Six Scenarios

**Requirement:** Prove the six baseline label cases.

| # | Scenario | ID | Beverage | What it tests | Expected |
|---|---|---|---|---|---|
| G-01 | Perfect spirit label | `perfect-spirit-label` | Distilled spirits | Happy-path baseline | `approve` |
| G-02 | Spirit warning errors | `spirit-warning-errors` | Distilled spirits | Government warning title-case + punctuation defect | `reject` |
| G-03 | Brand name case mismatch | `spirit-brand-case-mismatch` | Distilled spirits | Cosmetic mismatch downgrades to review, not fail | `review` |
| G-04 | Wine missing appellation | `wine-missing-appellation` | Wine | Vintage + varietal without appellation (cross-field) | `reject` |
| G-05 | Beer forbidden ABV format | `beer-forbidden-abv-format` | Malt beverage | ABV uses forbidden decimal format | `reject` |
| G-06 | Low-quality image | `low-quality-image` | Unknown | Blurry or low-confidence extraction | `review` |

All six have checked-in synthetic image assets under `evals/labels/assets/` and are the default seeded UI scenarios. The golden eval set in `evals/golden/manifest.json` contains 40+ additional cases.

---

## 8. Extraction Mode Routing

**Requirement:** Two-stage extraction with explicit cloud/local mode selection.

| Component | Location | Role |
|---|---|---|
| Provider policy | `ai-provider-policy.ts` | `ExtractionMode: 'cloud' | 'local'`; capability-based provider routing. |
| Gemini primary | `gemini-review-extractor.ts` | `gemini-2.5-flash-lite` with structured JSON output. |
| OpenAI fallback | `openai-review-extractor.ts` | `gpt-4o-mini` via Responses API, `store: false`. |
| Local mode | `transformers-review-extractor.ts` | Transformers.js self-hosted with degraded confidence posture. |
| UI selector | `ExtractionModeSelector.tsx` | Cloud vs. Local toggle in the signed-in shell. |
| Extractor factory | `review-extractor-factory.ts` | Resolves mode -> provider chain; enforces privacy boundary. |

---

## 9. Test Coverage

| Category | Count |
|---|---|
| Total test lines | ~7,560 across all test files |
| Test files | 45 |
| Passing tests | 206 |
| Batch route tests | 417 lines with streaming, retry, dashboard, export coverage |
| Warning validator tests | Full sub-check, edge-case, and confidence-interaction coverage |
| Contract tests | Schema boundary tests for every Zod contract |

---

## 10. Summary Table: Every Hard Constraint

| # | Hard Constraint | Doc Section | Code Path | Demo Path | Status |
|---|---|---|---|---|---|
| 1 | No persistence | `FULL_PRODUCT_SPEC.md:16` | `review-base.ts:252` `z.literal(true)`, `openai-review-extractor.ts:91` `store: false`, `batch-session.ts` `Map<>` | `/api/health` returns `store: false` | Enforced at schema level |
| 2 | OpenAI `store: false` | `FULL_PRODUCT_SPEC.md:17` | `openai-review-extractor.ts:31,74,91` type + runtime + env gate | `/api/health` returns `store: false` | Adapter refuses to start if violated |
| 3 | Gemini inline-only | `FULL_PRODUCT_SPEC.md:18` | `gemini-review-extractor.ts:123` `inlineData` | Gemini requests use no Files API | Enforced by request construction |
| 4 | 5-second target | `FULL_PRODUCT_SPEC.md:19` | `review-base.ts:59` budget=4000, `review-latency.ts` observer, `gemini-review-extractor.ts:28` timeout=5000 | `latencyBudgetMs` in every response | Monitored; not guaranteed under API contention |
| 5 | Deterministic outcomes | `FULL_PRODUCT_SPEC.md:22` | `government-warning-validator.ts`, field comparators, recommendation aggregator | Expanding any check row shows deterministic evidence | Enforced by architecture |
| 6 | Uncertain -> review | `FULL_PRODUCT_SPEC.md:23-24` | `government-warning-validator.ts:115,148,159` | Low-quality-image scenario shows `review` | Enforced in every validator path |
| 7 | Batch support | `FULL_PRODUCT_SPEC.md:59-66` | `batch-session.ts`, `review-batch.ts`, 67 batch files | Batch tab: upload, match, progress, dashboard, drill-in, export | Working; capped at 50 |
| 8 | Warning strictness | `FULL_PRODUCT_SPEC.md:125-126` | 895 lines across 3 validator modules, 5 sub-checks, character-level diff | Warning evidence panel with diff highlighting | 27 CFR 16.21/16.22 coverage |

---

## 11. What This System Is Not

These are explicit scope boundaries, not apologies:

- **Not a production system.** It is a procurement-ready demo artifact and proof of concept.
- **No database, no queue, no background jobs.** Everything is session-scoped and in-memory.
- **Batch cap is 50**, not 200-300. Serial processing, no parallelism.
- **Latency depends on external API response times.** The 5-second budget is a target and monitoring contract, not a guaranteed SLA.
- **Visual signal detection is model-dependent.** The deterministic layer compensates by defaulting uncertain claims to `review`.
- **No real authentication.** Mock Treasury SSO/PIV simulation only.
- **Local extraction mode is lower fidelity.** Small self-hosted model degrades extraction quality.
- **TTB-210 (prompt profiles) is blocked** on LangSmith auth. TTB-401 (final submission pack) is blocked on TTB-210.
