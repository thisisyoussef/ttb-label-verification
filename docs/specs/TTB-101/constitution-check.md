# Constitution Check

## Story

- Story ID: `TTB-101`
- Title: single-label intake and processing UI

## Non-negotiable rules checked

- UI freeze preserved: yes, Codex work is limited to server/shared/docs and does not edit `src/client/**`
- No persistence impact: yes, upload validation is constrained to per-request in-memory handling only
- Responses API with `store: false`: unchanged in this story; live model work remains deferred
- Deterministic validators own compliance outcomes: unchanged; this story does not add validator logic
- Shared contract impact reviewed: yes, this story formalizes intake payload, processing step IDs, and structured error shapes
- Latency and privacy constraints reviewed: yes, this story touches the single-label critical path and records local timing plus no-persistence proof

## Exceptions

- Actual client hookup to a live review route is deferred because `src/client/**` remains Claude-owned.
- Real extraction, beverage inference, and validator behavior stay in `TTB-201` through `TTB-205`.
