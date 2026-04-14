# Constitution Check

## Story

- Story ID: `TTB-102`
- Title: single-label results, warning evidence, and standalone UI

## Non-negotiable rules checked

- Approved UI preserved: yes, Codex work is limited to non-design client wiring plus the server/shared seed path needed to feed the frozen results surface
- No persistence impact: yes, the route still uses in-memory uploads only and the client still exports from an in-memory blob
- Responses API with `store: false`: unchanged; this story does not alter model orchestration
- Deterministic validators own compliance outcomes: unchanged; richer rule behavior remains in `TTB-205`
- Shared contract impact reviewed: yes, the existing `VerificationReport` contract is now consumed directly by the client instead of being schema-checked and discarded
- Latency and privacy constraints reviewed: yes, this story still sits on the single-label critical path and records local route timing plus no-persistence proof

## Exceptions

- The `/api/review` route remains seed-backed until `TTB-205` lands the full aggregation pipeline
- Batch backend work remains outside this story under `TTB-301`; only fixture-control cleanup was taken in `src/client/App.tsx`
