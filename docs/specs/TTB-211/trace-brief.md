# Trace Brief

## Story

- Story ID: `TTB-211`
- Title: LLM endpoint and mode eval matrix, persona scorecards, and trace regression gates

## Trace hypothesis

The current repo captures fixture-backed eval outcomes and trace ids, but the trace tree is too shallow to explain route behavior end to end. The winning implementation should produce one route-surface span per model-backed surface run, with nested stage spans for extraction and the deterministic follow-on work that shapes the user-visible outcome.

## Traced slice

- Local only
- Fixture-backed only
- Surfaces:
  - `/api/review`
  - `/api/review/extraction`
  - `/api/review/warning`
  - `/api/batch/run`
  - `/api/batch/retry`
- Commands:
  - `npm run env:bootstrap`
  - `npm run langsmith:smoke`
  - `LANGSMITH_TRACING=true LANGSMITH_TEST_TRACKING=true npm run eval:golden`

## Review focus in LangSmith

1. Route-surface span name identifies the endpoint surface instead of leaving only the extractor leaf visible.
2. Child spans show the stage sequence clearly:
   - extraction
   - warning validation when applicable
   - verification report build when applicable
3. Route-surface metadata records:
   - endpoint surface
   - extraction mode
   - provider
   - prompt profile
   - guardrail policy
   - client trace id when available
   - fixture id when available
4. Route-surface outputs include stage timings so latency and branch shape can be compared between runs.
5. Logged inputs and outputs remain privacy-safe: no raw image bytes, no raw application payload dumps, no user-submitted filenames beyond bounded runtime summaries.

## Failure taxonomy

- trace review stops at experiment summaries or eval roots instead of drilling into the route-surface span
- deterministic follow-on stages are invisible in the trace tree
- endpoint or prompt provenance is missing from route-surface metadata
- fixture identity cannot be correlated back to the eval case
- trace outputs include raw payloads instead of bounded summaries
- retry and batch runs cannot be distinguished cleanly from single-label runs

## Change log

### Iteration 1

- Added root surface traces for review, extraction, warning, batch run, and batch retry paths
- Nested extraction, warning-validation, and verification-report spans under the route surface trace
- Added stage timing summaries to the route-surface outputs
- Threaded client trace ids through route test helpers and fixture eval runners

### Iteration 2

- Ran traced golden eval after the surface-level tracing landed
- Verified each eval example now contains a nested route-surface span instead of forcing inspection to stop at the fixture LLM leaf
- Recorded representative experiment sessions, eval roots, route-surface span ids, child stage names, and stage timing summaries for review, extraction, warning, batch run, and batch retry
- Increased `ls.vitest.config.ts` `hookTimeout` to `120000` after the first fully traced pass hit a LangSmith post-test hook timeout even though all 18 eval assertions passed

## Winning traces

Representative evidence from the traced `LANGSMITH_TRACING=true LANGSMITH_TEST_TRACKING=true npm run eval:golden` run:

- Review experiment session `4385a082-2aab-4cfc-8ee1-21732a55f2bf`; `G-02` eval root `019d8d7c-c0ad-7000-8000-001d8b99bac9`; route-surface span `019d8d7c-c0bb-7000-8000-0763884ebb84` (`ttb.review_surface.execution`) with child spans `ttb.review_extraction.stage`, `ttb.warning_validation.stage`, `ttb.review_report.stage`; stage timings `extraction=6`, `warning=4`, `report=1`, `total=11`
- Extraction experiment session `2a3792ef-562f-44ff-8da2-2384ce54110a`; `G-39` eval root `019d8d7c-d122-7000-8000-0233103326b0`; route-surface span `019d8d7c-d125-7000-8000-024d2421218f` (`ttb.extraction_surface.execution`) with child span `ttb.review_extraction.stage`; stage timings `extraction=1`, `total=1`
- Warning experiment session `8314655a-95d8-42f1-91a7-74be288e5d59`; `G-06` eval root `019d8d7c-d766-7000-8000-07bac1d32f6c`; route-surface span `019d8d7c-d768-7000-8000-03106550eceb` (`ttb.warning_surface.execution`) with child spans `ttb.review_extraction.stage`, `ttb.warning_validation.stage`; stage timings `extraction=1`, `warning=0`, `total=1`
- Batch-run experiment session `13dc0f1b-56cb-4c47-867a-b2d99117c6c1`; `G-34` eval root `019d8d7c-bfb3-7000-8000-03cacde7a9eb`; route-surface span `019d8d7c-bfd3-7000-8000-0614fb2b81b3` (`ttb.review_surface.execution`) with metadata `endpointSurface=/api/batch/run` and `fixtureId=batch-image-001`; child spans `ttb.review_extraction.stage`, `ttb.warning_validation.stage`, `ttb.review_report.stage`; stage timings `extraction=5`, `warning=1`, `report=1`, `total=8`
- Batch-retry experiment session `13dc0f1b-56cb-4c47-867a-b2d99117c6c1`; `G-36` eval root `019d8d7c-c4a4-7000-8000-02f9ef253868`; retry route-surface span `019d8d7c-c4ae-7000-8000-01fe73a90cbc` (`ttb.review_surface.execution`) with metadata `endpointSurface=/api/batch/retry` and `fixtureId=batch-image-001`; child spans `ttb.review_extraction.stage`, `ttb.warning_validation.stage`, `ttb.review_report.stage`; stage timings `extraction=1`, `warning=0`, `report=0`, `total=2`

## Remaining risk

- The prompt profile and guardrail policy names are still static placeholders until `TTB-210` lands.
- For `langsmith/vitest` evals, manual trace lookup must start from the experiment session id and then drill into the eval root run; the default app project name is not sufficient evidence on its own.
