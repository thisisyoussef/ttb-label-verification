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
