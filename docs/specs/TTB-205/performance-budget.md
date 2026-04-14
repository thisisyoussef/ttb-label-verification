# Performance Budget

## Story

- Story ID: `TTB-205`

## Budget

- deterministic aggregation must stay under `500 ms`
- total `/api/review` response target remains `<= 5,000 ms`

## Current note

- Deterministic aggregation stays inside the local unit/integration test envelope, but live end-to-end timing still needs a corpus-backed measurement run once the six label assets are present.
- A local `/api/review` smoke attempt on 2026-04-13 hit the structured extractor network error before a usable timing sample could be recorded.
