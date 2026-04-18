# Constitution Check

## Story

- Story ID: `TTB-EVAL-002`
- Title: Gemini Batch golden-set live eval runner and cost discipline

## Applicable repo rules

1. Approved eval tooling must not replace the canonical fixture-backed golden gate.
   - Source: `AGENTS.md`, `evals/README.md`
2. Gemini product runtime remains inline-only and must not adopt Files API or other durable upload surfaces.
   - Source: `AGENTS.md`, `docs/specs/FULL_PRODUCT_SPEC.md`, `docs/specs/TTB-206/privacy-checklist.md`
3. No user submission data may be persisted; any Gemini Batch tooling must stay limited to checked-in approved eval assets and local result artifacts.
   - Source: `AGENTS.md`
4. Standard Codex work needs a packet, story-scoped branch tracking, TDD, and verification.
   - Source: `AGENTS.md`, `docs/process/CODEX_CHECKLIST.md`, `docs/process/GIT_HYGIENE.md`

## Story-specific decisions

- Scope is tooling only: `scripts/**`, tests, docs, tracker, and memory updates.
- The runner will use Gemini Batch inline requests only. It will not use Gemini Files API.
- The runner is opt-in and eval-only. It will not change `src/server/index.ts`, route behavior, or `npm run eval:golden`.
- The runner may only operate on checked-in approved eval manifests/assets. It must refuse ad hoc paths outside the repo-managed eval corpus.

## Non-goals

- No runtime route changes.
- No prompt-policy or deterministic-validator changes.
- No replacement of the fixture-backed golden gate.
