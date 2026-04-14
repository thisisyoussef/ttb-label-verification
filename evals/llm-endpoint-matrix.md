# LLM Endpoint Matrix

This matrix is the route-aware golden gate for the current model-backed surfaces.

| Endpoint surface | Extraction mode | Golden slice | Primary promise | Scorecard focus |
| --- | --- | --- | --- | --- |
| `/api/review` | `cloud` | `endpoint-review` | Integrated reviewer outcome with deterministic checks layered on extracted facts | Dave false-review control, Sarah demo consistency, Marcus privacy-safe provenance |
| `/api/review/extraction` | `cloud` | `endpoint-extraction` | Structured evidence completeness and uncertainty reporting | Jenny evidence completeness, Marcus provenance and no-persistence proof |
| `/api/review/warning` | `cloud` | `endpoint-warning` | Focused government-warning fidelity and visual-signal judgment | Sarah showcase consistency, Jenny warning-fidelity quality |
| `/api/batch/run` | `cloud` | `endpoint-batch` | Row-isolated batch execution with stable status summaries | Janet row consistency, Marcus provenance and privacy-safe tracing |
| `/api/batch/retry` | `cloud` | `endpoint-batch` | Retry containment for a previously errored row | Janet recovery and containment, Marcus provenance and privacy-safe tracing |

## Run rule

- Run the smallest applicable endpoint slice for the surface and extraction mode being changed.
- Run `npm run eval:golden` before any reviewable push that could reach staging.
- When `LANGSMITH_API_KEY` is present, enable tracing only for the eval command and keep inputs fixture-backed.
