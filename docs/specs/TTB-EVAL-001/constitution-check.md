# Constitution Check

## Story

- Story ID: `TTB-EVAL-001`
- Title: six-label eval corpus and run discipline

## Non-negotiable rules checked

- No persistence: satisfied; this story defines synthetic or sourced eval assets and checked-in run logs, not durable storage of user submissions.
- Responses API with `store: false`: satisfied; no model call is added in this story, but the eval gate and future run logs explicitly assume `store: false` for any live evaluations.
- Deterministic validators own compliance outcomes: satisfied; eval expectations are defined against final recommendation behavior after deterministic validation, not model-only judgment.
- Shared contract impact reviewed: satisfied; the eval corpus is designed to target the shared review contract and future evidence payloads.
- Latency or UX constraints reviewed: satisfied; run logs must record measured latency for single-label cases.

## Exceptions

- None.
