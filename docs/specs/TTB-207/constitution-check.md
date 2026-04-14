# Constitution Check

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation
- Lane: Codex-only

## Non-negotiables

- No uploaded label image, application field, or result may be persisted.
- Gemini transport stays inline-only for this product; no Files API or AI Studio logging/dataset sharing.
- OpenAI fallback remains Responses-based with `store: false`.
- Final compliance outcomes remain deterministic and typed; the provider swap must not move judgment back into the model.
- The approved UI stays frozen; any contract changes must be justified and lane-safe.
- `trace-brief.md`, `eval-brief.md`, `privacy-checklist.md`, and `performance-budget.md` are required because this story changes model/provider behavior on the single-label critical path.

## Lane-specific scope

- In scope: extraction adapter, provider cutover, fallback thresholds, env/bootstrap wiring, tests, traces, eval notes, and timing proof.
- Out of scope: UI redesign, new storage, batch-specific UX changes, or replacing OpenAI for non-extraction callsites that do not exist yet.
