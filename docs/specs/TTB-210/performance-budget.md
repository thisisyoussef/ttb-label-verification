# Performance Budget

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## Single-label target

- End-to-end target remains governed by the active post-`TTB-209` budget.

## Additional overhead budget

- prompt-profile selection and assembly: `<= 25 ms`
- structural guardrail evaluation: `<= 50 ms`
- total overhead introduced by this story on the single-label path: `<= 100 ms`

## Measurement method

- measure route-level latency for:
  - `/api/review`
  - `/api/review/extraction`
  - `/api/review/warning`
- compare before/after timings on the same approved local fixture slice
- record whether batch item overhead remains bounded even when repeated across a session

## Story note

- If prompt/guardrail overhead cannot stay inside this budget, reduce overlay size and guardrail work before considering a provider/model change. This story is about safer prompting, not another provider migration.

## 2026-04-15 implementation note

- The cutover adds only prompt string selection plus post-parse object normalization; no extra provider call or route stage was introduced.
- Local verification:
  - `npm run test` passed after the prompt-policy + guardrail cutover.
  - `npm run eval:golden` passed on the fixture-backed endpoint slice.
  - `npm run build` passed.
- Measured implication:
  - the route-level fixture latencies stayed inside their existing local test bands after the change
  - no new latency-specific regression surfaced in `src/server/index.latency.test.ts`
- Remaining caveat:
  - published LangSmith traces are blocked by auth, so the story currently relies on local fixture timing plus the existing latency tests rather than a persisted traced comparison set
