# Technical Plan

## Scope

Add the measurement and budgeting foundation required to tune the single-label path to `<= 4,000 ms` without yet changing the visible contract target.

## Planned modules and files

- `src/server/review-latency.ts`
  - stage-span types
  - monotonic timer helpers
  - safe summary/redaction helpers for tests and evals
- `src/server/index.ts`
  - route wiring for single-label timing capture
- `src/server/batch-session.ts`
  - per-item timing capture for batch execution
- `src/server/gemini-review-extractor.ts`
  - provider-attempt timing hooks on the primary path
- `src/server/openai-review-extractor.ts`
  - provider-attempt timing hooks on the fallback path
- `src/server/review-report.ts`
  - timing handoff into eval/debug surfaces without changing the approved UI payload
- `evals/results/*`
  - measured latency run artifacts

## Measurement model

- Record only technical metadata:
  - stage id
  - provider id
  - outcome class (`success`, `fast-fail`, `late-fail`, `skipped`)
  - duration in milliseconds
- Do not record:
  - raw prompt text
  - extracted label text
  - application field values
  - filenames
  - base64 payloads

## Output strategy

- Timing must be available to tests and eval runs through an internal seam.
- Optional local diagnostics may expose bounded totals and stage summaries through a debug-only path or header gate, but timing data must not become a new stable user-facing contract.

## Budget framing

The story should publish the budget math the repo will optimize against in `performance-budget.md`:

- happy path: total `<= 4,000 ms`
- fast-fail fallback: total `<= 4,000 ms`
- late-fail rule: if there is not enough remaining budget for a second full provider attempt plus deterministic work, return a structured retryable error instead of exceeding the target

## Risks and fallback

- Risk: stage timing is added only at route level, hiding whether latency is model, network, or deterministic compute.
  - Fallback: capture both provider-attempt spans and deterministic post-extraction spans.
- Risk: timing instrumentation leaks sensitive request details through logs or eval artifacts.
  - Fallback: keep the timing schema numeric + categorical only and add privacy checks/tests around it.
- Risk: the future 4-second budget is framed around totals only, leaving no actionable stage targets.
  - Fallback: publish per-stage envelopes and force every later latency claim to map back to them.

## Testing strategy

- unit:
  - stage ordering and monotonic duration tests
  - redaction/safe-summary tests
- integration:
  - `/api/review` timing on success, fast-fail fallback, and late-fail exit
  - batch per-item timing capture
- eval:
  - per-case timing records against the approved latency fixture slice
