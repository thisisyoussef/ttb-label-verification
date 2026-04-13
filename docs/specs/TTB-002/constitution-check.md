# Constitution Check

## Story

- Story ID: `TTB-002`
- Title: single-label compliance engine and recommendation API

## Non-negotiable rules checked

- No persistence: satisfied; uploads, application input, model payloads, and results remain ephemeral and must not land in durable storage, queues, or logs.
- Responses API with `store: false`: satisfied; all model work in this story uses the Responses API and explicitly disables storage.
- Deterministic validators own compliance outcomes: satisfied; the model extracts and classifies, but validators determine final compliance outcomes and recommendation status.
- Shared contract impact reviewed: satisfied; this story expands `src/shared/contracts/review.ts` into a production-ready review/evidence contract for the approved UI.
- Latency or UX constraints reviewed: satisfied; the full single-label path must remain under the 5-second target and expose measured timings.

## Exceptions

- None.
