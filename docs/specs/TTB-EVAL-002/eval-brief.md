# Eval Brief

## Story

- Story ID: `TTB-EVAL-002`
- Title: Gemini Batch golden-set live eval runner and cost discipline

## AI behavior being changed

This story does not change the shipped extraction prompt, validator logic, or route contracts. It changes how approved live eval corpus requests may be sent to Gemini for cost-optimized offline benchmarking.

## Expected gain

- Lower-cost live corpus sweeps for Gemini extraction benchmarking
- Better throughput for approved non-urgent eval runs
- Clearer separation between canonical fixture gate and optional live-cost tooling

## Failure modes to catch

- batch request assembly drifting from the runtime Gemini extractor request shape
- corpus selection silently exceeding the inline Batch limit
- per-request batch errors being treated as successful outputs
- malformed or schema-invalid model output being counted as a clean success
- docs implying Batch replaces `npm run eval:golden`

## Eval inputs

- approved checked-in live extraction corpus (`cola-cloud` plus `supplemental-generated`)

## Pass criteria

- The runner submits only approved inline requests under the size ceiling.
- The runner records success/error/parse-failure per case.
- The docs preserve `npm run eval:golden` as the canonical gate.

## Verification note

- 2026-04-18 dry run: `npx tsx scripts/run-gemini-batch-extraction-benchmark.ts --dry-run --output evals/results/2026-04-18-TTB-EVAL-002-gemini-batch-dry-run.json`
- Observed corpus size: `35` approved live cases (`28` `cola-cloud`, `7` `supplemental-generated`)
- Estimated inline payload: `2,104,561` bytes against a `19,922,944` byte ceiling
- Live provider submission intentionally not run as part of the default verification path for this story
