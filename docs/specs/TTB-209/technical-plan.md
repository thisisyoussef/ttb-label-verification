# Technical Plan

## Scope

Use the timing foundation from `TTB-208` to tune the default Gemini path to its best measured profile, harden the timeout policy around the repo’s `<= 5,000 ms` contract, and record the evidence for not cutting the public budget to `4000`.

## Planned modules and files

- `src/server/gemini-review-extractor.ts`
  - low-latency primary-model profile experiments
  - media-resolution tuning if adopted
  - priority-tier support if adopted
- `src/server/openai-review-extractor.ts`
  - lower-latency fallback profile experiments
  - priority-tier support if adopted
  - cache-friendly prompt structuring if adopted
- `src/server/review-latency.ts`
  - deadline-aware fallback decisions based on remaining budget
- `src/server/index.ts`
  - route-level budget and timeout policy observation
- `src/server/batch-session.ts`
  - tuned per-item budget handling
- `src/shared/contracts/review-base.ts`
  - keep `latencyBudgetMs` at `5000` unless a later story proves a lower contract honestly
- `src/shared/contracts/review-seed.ts`
  - no contract cutover in this story
- `src/shared/contracts/review.test.ts`
  - contract stays aligned with the `5000` budget

## Optimization levers

### Provider/model right-sizing

- Evaluate the primary Gemini path with `Gemini 2.5 Flash` and `Gemini 2.5 Flash-Lite`.
- Evaluate the OpenAI fallback profile against the current `OPENAI_VISION_MODEL` default and at least one lower-latency fallback candidate exposed through env/config.
- Record the winning pair and the rollback condition in the packet.

### Prompt and schema slimming

- Remove redundant instructions that do not improve extraction quality.
- Keep the structured-output schema as small and flat as the approved contract allows.
- Put static instructions and schemas before variable user content to maximize cache-friendly prefixes where the provider offers safe in-memory or implicit caching.

### Request-profile tuning

- Evaluate Gemini global `media_resolution` settings where the docs indicate a latency/detail tradeoff.
- Keep any reduced-resolution path conditional on quality proof for small warning text and dense label layouts.
- Do not use Gemini explicit caching or OpenAI extended prompt caching as the baseline latency mechanism.
- For Gemini 2.5 Flash-family models, explicitly control thinking budget for extraction-oriented requests when speed is the priority.

### Priority-tier support

- OpenAI: evaluate `service_tier=priority` for truly latency-sensitive requests.
- Gemini: evaluate `serviceTier: priority` and detect downgrade headers/fields.
- Keep both behind config so the repo can separate baseline behavior from premium cost/reliability experiments.

### Deadline-aware fallback

- Compute remaining budget after the primary provider attempt.
- If the remaining time cannot support the measured fallback envelope plus deterministic work, return a retryable error instead of issuing a second full provider call.

## Risks and fallback

- Risk: the fastest Gemini profile weakens warning-text fidelity or small-text extraction.
  - Fallback: keep the higher-fidelity profile for those cases or reject the faster candidate.
- Risk: reduced media resolution improves latency but harms quality on PDFs or low-quality images.
  - Fallback: keep a higher-fidelity default and use the lower-resolution path only when proven safe.
- Risk: priority tiers improve latency but are too expensive or downgrade unpredictably.
  - Fallback: leave them disabled by default and treat them as optional deployment-level accelerants.
- Risk: a slow failure still triggers a second provider call and blows the target.
  - Fallback: enforce the late-fail cutoff in the latency helper and treat it as part of correctness, not tuning.

## Testing strategy

- unit:
  - tuned request-profile selection
  - Gemini timeout and telemetry defaults
- integration:
  - optimized review route on primary success
  - fast-fail fallback inside budget
  - late-fail retryable exit inside budget
- eval + trace:
  - compare baseline `TTB-207`/`TTB-208` timing against the optimized profiles on the approved fixture slice

## 2026-04-14 implementation notes

- Implemented request-profile tuning in `src/server/gemini-review-extractor.ts`:
  - raster labels now default to Gemini `mediaResolution=low`
  - PDFs now default to Gemini `mediaResolution=medium`
  - Gemini 2.5 Flash-family models now default to `thinkingBudget=0` unless explicitly overridden
  - successful Gemini calls now record internal latency metadata for observed service tier and prompt/thought token usage
- Measured comparison on the 20-case local image slice:
  - `gemini-2.5-flash-lite` with smart media defaults and `6000 ms` timeout is the current winner
  - requesting Gemini `priority` did not improve the slice; successful responses still reported `serviceTier=standard`
  - `gemini-2.5-flash` remained slower even with `thinkingBudget=0`
  - exploratory `gemini-2.0-flash-lite` calls returned `404` and are not viable in this environment
- Shipped decision:
  - the improved Gemini profile is materially better than the prior baseline, but it still does not prove a `<= 4000 ms` public target
  - the checked-in default timeout is therefore raised to `5000 ms`, the public contract remains `5000`, and the tighter cutover is explicitly deferred
