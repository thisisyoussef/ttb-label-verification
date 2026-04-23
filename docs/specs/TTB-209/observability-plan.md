# Observability Plan

## Story

- Story ID: `TTB-209`
- Title: cloud/default Gemini hot-path tuning and latency policy hardening
- Follow-up: 2026-04-23 first-result timeout hardening

## Problem to localize

Some single-label inputs still spend far too long in the review route even after the earlier `TTB-209` tuning pass. The fix needs enough local evidence to distinguish:

- primary provider wait that never resolves inside budget
- late fallback that should not have been started
- helper-stage work that extends the route after extraction is already available

## Required signals

- Existing `ReviewLatencySummary` stage spans remain the primary source of truth.
- The first-result deadline itself must be reflected in the executed path through existing numeric or categorical metadata, not raw request content.
- The server must keep emitting `X-Stage-Timings` on successful responses so local repros can still attribute wall-clock cost by stage.

## Safe telemetry additions

- internal deadline budget used for the request
- remaining-budget decisions at the fallback seam
- whether an optional helper stage was skipped because the remaining budget was exhausted

These values must stay numeric or categorical only. Do not log label text, application values, filenames, or prompt bodies.

## Branches to verify

1. Primary success inside budget
2. Retryable primary failure with fallback success inside the new budget
3. Budget-exhausted late failure that returns the existing retryable error
4. Extraction success followed by helper-stage skip because no safe budget remains

## Test hooks

- unit coverage around the new deadline helper and fallback-budget math
- integration coverage in `src/server/index.latency.test.ts` for the timeout and fallback branches
- factory-level coverage in `src/server/extractors/review-extractor-factory.test.ts` for the revised budget rule

## Manual trace target

- a small remote or local stage-timing probe on one known long-tail label after the code change so the packet records whether the route now fails or completes inside the bounded window instead of drifting into minute-scale waits
