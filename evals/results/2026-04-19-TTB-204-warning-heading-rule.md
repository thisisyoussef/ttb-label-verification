# 2026-04-19 TTB-204 Eval Result

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Dataset slices

- `warning-heading-follow-up`
- `validator-unit-fixtures`

## Endpoint context

- Endpoint surface: pure validator plus prompt-policy unit coverage
- Extraction mode: n/a
- Provider: n/a
- Prompt profile: warning review prompt overlay for heading boldness
- Guardrail policy: deterministic warning sub-check aggregation
- Trace mode: dry local unit run
- LangSmith project: n/a
- Trace ids: none
- Latency notes: unit-only verification; no live model calls or route timings were introduced by this follow-up
- Persona-specific observations: Jenny-sensitive warning evidence remains explicit, while Sarah/Dave-facing review output is less punitive for body-case-only differences

## Cases run

- `body-case-only-warning`
- `showcase-warning-defect`
- `missing-word-warning`
- `warning-threshold-review-band`
- `warning-prompt-heading-boldness`

## Live asset status

- Required live assets: no
- Missing live assets: none for this unit-focused follow-up

## Expected vs actual

| Case | Expected | Actual | Latency | Notes |
| --- | --- | --- | --- | --- |
| `body-case-only-warning` | `pass` with heading still separately checked | `pass` | test runtime only | body letter case no longer hard-fails exact wording |
| `showcase-warning-defect` | `fail` | `fail` | test runtime only | exact-text drops to `review`; heading defect still blocks approval |
| `missing-word-warning` | one warning wording downgrade, not two | matched | test runtime only | missing-language focus no longer stacks on top of exact-text |
| `warning-threshold-review-band` | near-match stays `review` until wording is exact | matched | test runtime only | high similarity alone no longer auto-passes |
| `warning-prompt-heading-boldness` | prompt compares heading boldness to following words | matched | test runtime only | prompt now scopes boldness to the opening heading only |

## Persona scorecards

- Sarah: reviewer-facing output stays decisive on true warning defects without rejecting body-case-only noise.
- Dave: cosmetic case-only body differences no longer look like a substantive mismatch.
- Jenny: warning evidence keeps the five canonical sub-checks while the heading-only format rule stays explicit.
- Marcus: no persistence change; this follow-up stayed inside local deterministic/unit validation.
- Janet: no batch-specific behavior changed.

## Privacy and trace notes

- Fixture-only or sanitized inputs: fixture-only unit inputs
- `noPersistence` proof: no storage path changed; follow-up only touched validator aggregation and prompt wording
- Prompt/provider provenance recorded: yes, via `src/server/review-prompt-policy.ts` coverage for the heading-boldness instruction

## Regressions

- none in the targeted warning-validator slice

## Follow-up

- Targeted mutation run `npm run test:mutation -- --mutate "src/server/government-warning-subchecks.ts"` completed with `51.57%` mutation score (`80` killed, `61` survived, `2` timed out, `16` no coverage, `91` errors); the survivors cluster around heading/legibility helper branches and string-level subcheck messages, so warning-subcheck coverage still needs a focused hardening pass before this logic should be treated as mutation-strong.
- Run a broader fixture or live warning-route sweep before the next publish pass if the repo-wide dirty worktree and gate blockers are cleared.
