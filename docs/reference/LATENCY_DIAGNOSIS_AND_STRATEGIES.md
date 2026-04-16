# Latency diagnosis — how to consistently hit <5s per label

**Target:** Sarah Chen's own benchmark: "If we can't get results back in about 5 seconds, nobody's going to use it." This means p50, p95, and max should all be under 5s.

**Current state on cola-cloud-all (28 labels, cloud Gemini):**

| Metric | Value |
|--------|-------|
| avg | 5.9s |
| p50 | 7.4s (ABOVE budget) |
| p95 | 11.8s |
| max | 17.1s |
| Over-5s labels | **15 / 28 (54%)** |

The product is over budget more than it's under. Personal is a visible warning indicator per label (shipped in this commit). Below is where the time actually goes and what we can do about it.

---

## Where the time goes (per-label breakdown)

Measured via `latencyCapture.recordSpan()` traces. Typical contributions per label in the current pipeline (cloud mode):

| Stage | Current | Notes |
|-------|---------|-------|
| Image preprocessing (sharp) | 80-200ms | Runs in parallel with VLM — effectively free |
| Tesseract OCR pre-pass | 500-1500ms | Parallel with VLM |
| Warning OCV (region crop + OCR) | 400-1200ms | Parallel with VLM |
| **VLM extraction (Gemini)** | **2500-5000ms** | **The long pole** |
| Report assembly + judgment | 5-50ms | Deterministic; effectively free |

Since OCR + OCV run in parallel with the VLM, the critical path is **max(OCR + OCV, VLM)** ≈ the VLM call time.

**The 7-17s tails on slow labels are almost entirely on the VLM side:**
- Gemini 5xx transient → retry adds 200-800ms backoff + a second API call
- Gemini hitting slow-model buckets during peak → a 12s response isn't unusual on Flash-Lite
- Dense labels (wine with tiny text) → more output tokens → longer generation

---

## Why reducing VLM latency is the only lever

The other stages cannot be meaningfully shrunk:
- Tesseract OCR is already CPU-bound and deterministic; cutting it would lose the OCR-first merge that catches VLM hallucinations.
- Warning OCV is already parallel.
- Judgment / report assembly are already ~0ms.

So every strategy below targets the VLM call.

---

## Strategies to hit <5s consistently (ranked by impact × cost)

### S1. Cap Gemini generation output tokens (cheap, high impact)

Gemini 2.5 Flash-Lite with no cap will stream until the schema is satisfied or hits model limits. For our fixed ReviewExtraction schema, the output is at most ~800 tokens. A `max_output_tokens` cap of 1024 prevents 8-12s long-tail generations.

Estimated impact: **trims worst-case p95 by 3-5s, avg by 0.5-1s.**
Cost: ~10 lines in `gemini-review-extractor.ts`. No accuracy risk as long as the cap covers the full schema.

### S2. Kill the retry on structured-output parse failures (cheap, medium impact)

`openai-review-extractor.ts` currently retries on `output_parsed` schema mismatches. These retries take ~3s each and almost never succeed — if the model returned malformed JSON once, it's likely to again. Better to fall through to the other provider immediately.

Estimated impact: **trims the 15-17s tail on label formats that confuse the model.**
Cost: 5 lines. Already partially done in the Gemini path; OpenAI needs the same treatment.

### S3. Switch to Gemini 2.5 Flash (not Flash-Lite) when latency is critical (cheap-ish, medium impact)

Counterintuitively, Flash is often faster than Flash-Lite because it doesn't hit the same slow buckets. Flash-Lite was optimized for cost; Flash for latency. Benchmark both on the cola-cloud-all corpus.

Estimated impact: **0.5-2s p50 improvement** if benchmarks confirm.
Cost: env var flip + eval run.

### S4. Pre-warm Tesseract + pre-load OCV models on boot (cheap, small impact)

First-request latency is worse by 500-1500ms because Tesseract loads language data and OCV models lazy-load. A boot-time warmup `spawn tesseract --version` plus a 1×1 dummy classification eliminates that.

Estimated impact: **-500-1000ms on the first 5-10 labels of a batch.**
Cost: ~20 lines in `createApp`.

### S5. Stream the VLM response and kick off the report build early (medium cost, medium impact)

Gemini supports streaming. Instead of waiting for the full response, parse fields as they arrive and start the deterministic report assembly in parallel. When the VLM finishes, the report is ~instantly done.

Estimated impact: **-200-400ms average.**
Cost: ~100 lines — need to buffer partial JSON, handle errors on incomplete output. Worth it only if S1-S4 don't get us there.

### S6. Local Ollama on RunPod GPU (big cost, biggest impact)

The current 5.9s avg is dominated by Gemini network + scheduling. A local Qwen2.5-VL-3B on a dedicated RTX A5000 runs in ~2.5-4s with zero cold-start jitter.

**Measured on M-series Metal:** local mode avg 5.4s, p95 8.5s — already beats cloud.  
**Projected on RunPod RTX A5000:** avg 3-4s, p95 5-6s. Would hit the <5s budget consistently.

Estimated impact: **the biggest lever — probably 1.5-3s off p95.**
Cost: RunPod hosting (~$0.40/hr for A5000), + the work the RunPod agent already shipped.

### S7. Precompute extraction on upload (already shipped)

Speculative prefetch fires the extraction call when the user drops the file, before they click "Verify." When they click, the result is already cached: ~0ms perceived.

Impact: **perceived latency → 0ms when user fills the form for >3s.**
Status: **already enabled by default** (hardcoded in `useSingleReviewFlow.ts`).

### S8. Batch-side parallelism within a pack (large cost, large impact)

For batch mode, process 3-5 labels concurrently on the server. The current batch runner is sequential because each label races to the same Gemini rate limits — but at 500 labels/minute (Gemini Flash-Lite paid quota), we can run 3-4 concurrently without contention.

Estimated impact: **a 28-label pack from 165s to ~55s.**
Cost: ~150 lines. Needs careful handling of NDJSON interleaving for the UI.

---

## Recommended rollout order

1. **S1 (cap tokens)** — ship this week. No risk, biggest tail reduction per LOC.
2. **S4 (pre-warm)** — ship this week. Eliminates cold-start penalty on batch.
3. **S2 (no-retry on schema fails)** — ship this week. Already done for Gemini, port to OpenAI.
4. **S3 (Flash vs Flash-Lite benchmark)** — one eval run to confirm, then flip.
5. **S6 (RunPod local)** — RunPod artifacts already exist; deploy and benchmark.
6. **S8 (batch parallelism)** — only if S1-S6 don't get batch <60s.
7. **S5 (streaming)** — last-resort optimization; likely unnecessary after S1+S6.

---

## Status — what shipped with this diagnosis

- **Warning indicator >5s** — `EvalDemoResults` now surfaces a red ⚠ on any row that exceeded the 5s budget. Visible at a glance so reviewers can click through to the slow labels.

## Not yet shipped — concrete follow-ups

- [ ] **S1**: Add `maxOutputTokens: 1024` to the Gemini extractor config. File: `src/server/gemini-review-extractor.ts`, near the `generateContent` call.
- [ ] **S2**: Remove the `retryable: true` on OpenAI schema parse failures. File: `src/server/openai-review-extractor.ts:201-206`.
- [ ] **S3**: Run an A/B — `gemini-2.5-flash` vs `gemini-2.5-flash-lite`. Env: `GEMINI_VISION_MODEL`. Record in `evals/results/`.
- [ ] **S4**: Add a warmup step in `createApp`. Fire a dummy `exec('tesseract --version')` + a 1×1 dummy OCR call.
- [ ] **S6**: Deploy to RunPod via `scripts/deploy-runpod.sh --launch --gpu A5000`; benchmark; if p95 < 5s, switch primary.
