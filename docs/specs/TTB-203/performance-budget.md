# Performance Budget

## Story

- Story ID: `TTB-203`
- Title: extraction adapter, beverage inference, and image-quality assessment

## Budget slice

- request parse and intake normalization: `<= 250 ms`
- single extraction model call: `<= 3,000 ms`
- beverage resolution and extraction shaping: `<= 100 ms`
- extraction-only response serialization: `<= 100 ms`
- total extraction route target: `<= 3,500 ms`

## Measurement method

- Run route-level tests for correctness and config behavior.
- When the real label binaries are available under `evals/labels/assets/`, measure `POST /api/review/extraction` against the local server and record per-case latency.

## Current result

- Repo-local OpenAI runtime config now bootstraps with `npm run env:bootstrap`; live model timing is still blocked until the real label binaries under `evals/labels/assets/` are available.
- Non-model route and helper correctness are covered by tests; the extraction-only route also fails fast with a structured 503 when the environment is unconfigured instead of hanging or retrying.

## Story note

- This story should preserve most of the total 5-second product budget for later deterministic validation and response shaping.
