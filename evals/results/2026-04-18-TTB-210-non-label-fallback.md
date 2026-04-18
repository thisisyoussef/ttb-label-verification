# 2026-04-18 TTB-210 Eval Result

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## Dataset slices

- `endpoint-review`
- `endpoint-extraction`
- `endpoint-warning`
- `endpoint-batch`

## Endpoint context

- Endpoint surface:
  - `/api/review`
  - `/api/review/extraction`
  - `/api/review/warning`
  - `/api/batch/run`
  - `/api/batch/retry`
- Extraction mode: `cloud`
- Provider: fixture-backed route metadata on the shared extraction seam
- Prompt profile:
  - `/api/review` -> `review-extraction/review-cloud-v1`
  - `/api/review/extraction` -> `review-extraction/extraction-cloud-v1`
  - `/api/review/warning` -> `review-extraction/warning-cloud-v1`
  - `/api/batch/run` and `/api/batch/retry` -> `review-extraction/batch-cloud-v1`
- Guardrail policy: `review-extraction/structural-guardrails-cloud-v1`
- Trace mode: dry-run only for the fixture-backed eval gate
- LangSmith project: not used for this local fixture pass
- Trace ids: none
- Latency notes:
  - `npm run eval:golden` passed after syncing the no-text extraction expectation from `distilled-spirits` to `unknown`.
  - `npm run test`, `npm run typecheck`, and `npm run build` were also green on the same local worktree.
- Persona-specific observations:
  - Dave: non-label uploads no longer look like a confident spirits classification.
  - Jenny: the extraction route still returns explicit uncertainty and `no-text-extracted` state instead of hiding the failure.
  - Sarah: the extraction surface now better matches the “don’t be dumb” demo expectation for obvious non-label inputs.
  - Marcus: the fix is deterministic and packet-documented; no new persistence or tracing surface was introduced.
  - Janet: batch behavior stays unchanged because the fallback still uses the same shared resolver, only with a narrower spirits default.

## Cases run

- Review: `G-02`, `G-03`, `G-04`, `G-05`, `G-06`, `G-32`
- Extraction: `G-01`, `G-06`, `G-32`, `G-39`
- Warning: `G-01`, `G-02`, `G-06`, `G-29`, `G-31`
- Batch: `G-34`, `G-35`, `G-36`

## Live asset status

- Required live assets: no
- Missing live assets: none for the fixture-backed endpoint gate

## Expected vs actual

| Case | Expected | Actual | Latency | Notes |
| --- | --- | --- | --- | --- |
| extraction no-text fixture (`G-39`) | `beverageType=unknown`, `beverageTypeSource=strict-fallback`, `imageQualityState=no-text-extracted` | pass | fixture gate passed | no-text / non-label auto-detect no longer masquerades as spirits |
| remaining endpoint slices | no contract drift | pass | fixture gate passed | shared prompt-profile and guardrail metadata unchanged |

## Persona scorecards

- Sarah: obvious non-label failures now read as safer and more demo-stable.
- Dave: the route stops overcalling a commodity when the image is not credibly a beverage label.
- Jenny: uncertainty remains explicit in the extraction payload.
- Marcus: no persistence, provider, or tracing posture changed.
- Janet: batch keeps the same centralized extraction seam and did not regress.

## Privacy and trace notes

- Fixture-only or sanitized inputs: yes
- `noPersistence` proof: unchanged; no new storage or logging path was added
- Prompt/provider provenance recorded: yes through the existing route-aware fixture eval metadata

## Regressions

- None in the fixture-backed endpoint gate after updating the stale no-text expectation

## Follow-up

- Mutation coverage for `src/server/review-extraction.ts` remains waived for now because the current Stryker harness is failing on local environment constraints (`ENOSPC` temp-space exhaustion, then sandbox copy `ENOENT` on hashed `dist/assets` files), not on the changed fallback logic.
