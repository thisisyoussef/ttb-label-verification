# Trace Brief

## Story

- Story ID: `TTB-209`
- Title: cloud/default Gemini hot-path tuning and latency policy hardening

## Hypothesis

A tuned Gemini-primary extraction profile plus an honest timeout policy can keep the cloud default aligned with the repo’s `<= 5,000 ms` target without losing the structured extraction quality needed by deterministic validators.

## Smallest approved fixture slice

- one clear raster label
- one PDF label
- one low-quality or small-text label

## Variables to test one at a time

- Gemini model choice (`Gemini 2.5 Flash` vs `Gemini 2.5 Flash-Lite`)
- OpenAI fallback profile
- prompt/schema slimming
- Gemini media resolution profile
- optional priority-tier toggles
- timeout-policy variants (`3000`, `5000`, `6000`)

## Review focus

- provider wait time
- total route time
- warning-text fidelity
- field omission or false-presence drift
- late-fail cutoff correctness

## Winning-output requirement

- record the winning profile
- record the losing profiles and why they failed
- record the rollback trigger if production measurements later drift above the target

## 2026-04-14 trace and benchmark notes

- Traced slice:
  - `LANGSMITH_TRACING=true NODE_ENV=test AI_CAPABILITY_LABEL_EXTRACTION_ORDER=gemini GEMINI_VISION_MODEL=gemini-2.5-flash-lite GEMINI_TIMEOUT_MS=6000 npx tsx .tmp/ttb-209-live-probe.ts --route extraction --scenario perfect-spirit-label --trace-id ttb-209-trace-perfect-spirit-label`
- Latest trace:
  - LangSmith trace id: `019d8ea3-45e0-7000-8000-064f7c704dd3`
- Winning profile so far:
  - `gemini-2.5-flash-lite`
  - smart media defaults: raster `low`, PDF `medium`
  - observed tier on successful calls: `standard`
  - measured clear-raster trace: `4363 ms` total, with `4346 ms` inside Gemini provider wait
- Losing profiles:
  - `gemini-2.5-flash-lite` + requested `priority`: no improvement on the 20-case slice; successful responses still reported `serviceTier=standard`
  - `gemini-2.5-flash` + `thinkingBudget=0`: slower average and worse timeout distribution
  - `gemini-2.0-flash-lite`: `404` adapter failures on all 20 cases in this environment
  - slimmer `cloud-cross-provider-v2` prompt profile: prompt tokens dropped from about `1261` to about `283`, but the measured review average only moved to about `4.85 s`, provider wait still dominated, and the runtime prompt was reverted to the more accurate `v1` profile
- Rollback / non-cutover condition:
  - do not treat `latencyBudgetMs: 4000` as proved while the best 20-case `/api/review` average remains about `4.95 s`
  - ship the timeout policy at `5000 ms`, not `3000 ms`, because the `3000 ms` default returned `20/20` timeouts on the checked-in 20-case review slice
