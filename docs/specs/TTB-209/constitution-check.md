# Constitution Check

## Story

- Story ID: `TTB-209`
- Title: cloud/default Gemini hot-path tuning and latency policy hardening
- Parent: `TTB-002`
- Primary lane: Codex
- Packet mode: standard

## Non-negotiables

- No uploaded label image, application data, or verification result may be persisted.
- OpenAI integrations must keep `store: false`.
- Gemini integrations must remain inline-only with logging/data-sharing disabled; no Files API or explicit cache TTL surfaces are allowed.
- Explicit provider caching may not become the baseline solution for this story. Gemini explicit caching is out of bounds. OpenAI extended prompt caching may not be used on user-bearing requests.
- The approved UI remains fixed input. Performance work may touch `src/client/**` only if a non-design integration seam absolutely requires it.
- The visible `latencyBudgetMs` contract stays at `5000` in this story and may move lower only after new measured evidence proves it.

## Required companion artifacts

- `feature-spec.md`
- `technical-plan.md`
- `task-breakdown.md`
- `privacy-checklist.md`
- `performance-budget.md`
- `eval-brief.md`
- `trace-brief.md`

## Blocking notes

- `TTB-208` must land first so optimization decisions are grounded in stage timing instead of guesswork.
