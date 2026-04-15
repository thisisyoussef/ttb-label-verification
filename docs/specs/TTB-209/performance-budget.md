# Performance Budget

## Story

- Story ID: `TTB-209`
- Title: cloud/default Gemini hot-path tuning and latency policy hardening

## Final target

- Checked-in end-to-end single-label budget: `<= 5,000 ms`
- Explored but unproved stretch target: `<= 4,000 ms`

## Shipped budget posture

- The public contract stays at `latencyBudgetMs: 5000`.
- The shipped Gemini default now uses:
  - `gemini-2.5-flash-lite`
  - raster `mediaResolution=low`
  - PDF `mediaResolution=medium`
  - Flash-family `thinkingBudget=0`
  - requested service tier unset
  - `GEMINI_TIMEOUT_MS=5000`
- The fallback cutoff remains intentionally tight (`REVIEW_MAX_RETRYABLE_FALLBACK_ELAPSED_MS=550`) so a slow primary call does not start a second full provider attempt late in the request.

## Late-fail rule

If the primary provider has already consumed enough time that the remaining window cannot support a second full provider attempt plus deterministic work, return a structured retryable error instead of starting a late fallback. This story does not lower the public budget below `5000 ms`.

## Measurement method

- measure route-level latency for:
  - tuned primary success
  - timeout-policy variants on the checked-in 20-case slice
  - narrower extraction-only and warning-only routes
- record timings in the story packet and `evals/results/`
- do not update the shared contract below `latencyBudgetMs: 5000` without new measured proof

## 2026-04-14 measurement notes

- checked-in 20-case Gemini image slice:
  - manifest: `evals/labels/latency-twenty.manifest.json`
  - assets: 20 checked-in synthetic fixtures under `evals/labels/assets/`
- Best measured extraction profile so far:
  - model: `gemini-2.5-flash-lite`
  - request profile: implicit raster `low` media resolution, implicit PDF `medium` media resolution
  - requested service tier: unset
  - observed service tier header on successful runs: `standard`
  - timeout for measurement: `6000 ms`
- Measured results on that 20-case slice:
  - `/api/review/extraction`: average `4624 ms`, median `4400 ms`, p95 `5933 ms`, `19/20` success
  - `/api/review`: average `4946 ms`, median `4653 ms`, p95 `6013 ms`, `16/20` success
- Prompt/profile follow-up:
  - a slimmer `cloud-cross-provider-v2` prompt plus optional model-authored summary cut Gemini prompt tokens from about `1261` to about `283`
  - that change did not materially change hot-path latency:
    - `/api/review/extraction`: average `4823 ms`, median `4601 ms`, p95 `6015 ms`, `18/20` success
    - `/api/review`: average `4852 ms`, median `4728 ms`, p95 `6014 ms`, `15/20` success
  - conclusion: prompt slimming reduced request tokens and model-authored text, but provider wait still dominates and the route remains above the `<= 4000 ms` target
  - runtime decision: keep the more detailed accuracy-first prompt (`cloud-cross-provider-v1`) as the active profile; treat `v2` as a measured losing experiment
- Current checked-in `GEMINI_TIMEOUT_MS=3000` fast-fail posture is still too aggressive for the tuned Gemini path:
  - `/api/review` average `3005 ms`
  - `20/20` runs returned structured `504 timeout`
- Review route with `GEMINI_TIMEOUT_MS=5000` on the same 20-case slice:
  - average `4657 ms`, median `4832 ms`, p95 `5018 ms`, `13/20` success
- Ship decision:
  - raise the checked-in Gemini timeout default from `3000` to `5000`
  - keep `gemini-2.5-flash-lite` as the default model
  - leave priority tier disabled by default
  - keep the visible `latencyBudgetMs` contract at `5000`
- Conclusion: the tuned Gemini profile improved the default cloud path materially and removed the self-defeating `3000 ms` timeout default, but the story still does not prove a `<= 4000 ms` public budget.
