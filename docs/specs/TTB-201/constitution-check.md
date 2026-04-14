# Constitution Check

## Story

- Story ID: `TTB-201`
- Title: shared review contract expansion and seed fixture alignment
- Lane: Codex
- Status: in progress

## Lane-scoped rules

1. Preserve the approved `TTB-102` UI contract without redesigning `src/client/**`.
2. Start with failing contract tests before changing the shared schema.
3. Keep the no-persistence posture unchanged. This story expands payload shape only.
4. Limit client edits to type or integration wiring that reduces contract drift.

## In scope

- `src/shared/contracts/review.ts`
- `src/shared/contracts/review.test.ts`
- `src/server/**` only if the expanded contract requires seed-route adjustments
- `src/client/types.ts` only if shared-type reuse is needed to align with the contract
- `docs/specs/TTB-201/` packet expansion
- tracker, eval result, backlog handoff, and memory updates required by the story state

## Out of scope

- New validator logic
- OpenAI orchestration
- Frontend layout, styling, copy, or interaction changes
- Persistent storage or export-route work
