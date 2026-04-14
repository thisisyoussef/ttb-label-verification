# Eval Brief

## Story

- Story ID: `TTB-206`
- Title: extraction mode routing foundation and privacy-safe cloud/local provider policy

## AI behavior being changed

This story changes extraction-mode selection plus provider fallback policy, not the extracted review contract itself.

## Expected gain

- Establish one routing path for cloud vs local extraction later.
- Establish one routing path for Gemini-primary image/document extraction inside cloud mode later.
- Establish Gemini fallback as the default secondary provider policy for future non-image OpenAI-backed capabilities.
- Prevent privacy-unsafe Gemini features from sneaking in during the migration.

## Failure modes to catch

- wrong provider order for `label-extraction`
- wrong default extraction mode or missing mode seam for later UI wiring
- default capability order not falling back to Gemini
- invalid provider-order env strings being accepted silently
- OpenAI adapters bypassing the new factory path
- privacy-unsafe Gemini options being treated as normal fallback paths
- local-mode failures being treated as permission to call cloud providers

## Eval inputs or dataset slice

- injected fake-provider tests
- one route-level smoke slice with forced provider failures

## Pass criteria

- unit tests prove provider-order parsing and fallback classification
- route tests prove the current review contract still flows through the new factory path
- the packet and SSOT clearly separate `TTB-206` foundation work from `TTB-207` live cutover work
