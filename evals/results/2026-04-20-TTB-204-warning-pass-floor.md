# 2026-04-20 TTB-204 Eval Result

## Story

- Story ID: `TTB-204`
- Title: warning pass-floor follow-up

## Dataset slices

- `cola-cloud-all`
- focused scorer and warning-validator unit coverage

## Endpoint context

- Endpoint surface: `/api/review` live local corpus sweep
- Extraction mode: `cloud`
- Provider: local API against checked-in runtime
- Prompt profile: current checked-in review route prompt
- Guardrail policy: current checked-in warning/scoring policy
- Local evidence:
  - `npx vitest run src/server/validators/judgment-scoring-warning-leniency.test.ts src/server/validators/government-warning-thresholds.test.ts src/server/validators/government-warning-validator.test.ts src/server/validators/government-warning-vote.test.ts`
  - `BASE_URL=http://127.0.0.1:8787 npx tsx scripts/evals/remote-eval.ts --slice=cola-cloud-all`
- Runtime note: repo-local `.env` refreshed with `npm run env:bootstrap` before the live sweep

## Baseline vs final

| Run | Approve | Review | Reject | Error | Correct | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `2026-04-20T03-30-38-remote-cola-cloud-all.json` | `6` | `18` | `1` | `3` | `24/28` | warning review plus transient extraction 502s held many approvals down |
| `2026-04-20T03-56-39-remote-cola-cloud-all.json` | `12` | `15` | `1` | `0` | `27/28` | scorer leniency doubled approvals and the rerun completed without extraction errors |

## Change under test

- Downweight advisory government-warning reviews when the warning row is readable and contains no failing sub-checks.
- Allow the global `low-confidence` image-quality gate to fall through to weighted scoring when the only remaining issue is that advisory warning review.
- Keep hard warning failures unchanged.

## Expected vs actual

| Goal | Result |
| --- | --- |
| approved labels should stop getting trapped in `review` just because of advisory warning noise | matched |
| hard warning defects should still block approval | matched |
| the batch corpus should show a material approval lift | matched |

## Key findings

- The initial investigation showed the warning validator was not the only blocker; several warning-only review cases were being held by the scorer's unconditional `low-confidence` image-quality gate.
- After the first scorer change, the corpus moved from `6 approve` to `10 approve` and dropped the transient extraction errors.
- After widening the downweight to readable non-failing warning reviews, the final sweep reached `12 approve`, `15 review`, `1 reject`, `0 error`.
- Remaining review cases are concentrated in:
  - labels with real non-warning blockers (`alcohol-content`, `class-type`, `country-of-origin`, brand ambiguity)
  - labels where the warning text is still genuinely unreadable or missing in the supplied image
- Representative hard-stop example: `lake-placid-shredder-malt-beverage` can still surface a placeholder warning read (`GOVERNMENT WARNING: (text present but not fully legible)`) with ~18% wording alignment, which is not safe to auto-approve.

## Focused unit coverage

- `src/server/validators/judgment-scoring-warning-leniency.test.ts`
  - advisory warning review + low-confidence image quality now approves
  - low-confidence plus another substantive review still stays `review`
  - warning reviews with a failing sub-check still stay `review`
  - readable non-failing warning reviews are downweighted even when image quality is otherwise `ok`

## Regressions

- none in the focused warning/scoring suite
- one expected live reject remains in `cola-cloud-all` due a substantive non-warning failure (`manzone-giovanni-barolo-perno-wine` -> `alcohol-content:fail`)

## Follow-up

- If more approvals are still desired, the next step is not another scorer nudge. The remaining warning-held labels now mostly need extraction-quality improvements, because the warning row is still genuinely unreadable or incomplete in the supplied image.
