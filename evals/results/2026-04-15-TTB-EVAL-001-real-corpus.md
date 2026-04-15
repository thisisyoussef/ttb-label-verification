# 2026-04-15 TTB-EVAL-001 Eval Result

## Story

- Story ID: `TTB-EVAL-001`
- Title: golden eval set foundation and run discipline

## Dataset slices

- `cola-cloud-real`
- supplemental candidate: `evals/labels/assets/supplemental-generated/lake-placid-shredder-abv-negative.webp`

## Endpoint context

- Endpoint surface: `/api/review`
- Extraction mode: `cloud`
- Provider: configured runtime provider chain from repo-local `.env`
- Prompt profile: runtime `/api/review` prompt policy
- Guardrail policy: runtime `/api/review` guardrail policy
- Trace mode: dry-run
- LangSmith project: not used
- Trace ids: none
- Latency notes: live smoke only; no formal latency gate captured in this run log
- Persona-specific observations:
  - Dave: the real-label smoke still trends conservative, favoring `review` when warning certainty is weak
  - Jenny: check-level output stayed legible enough to explain why a real approved label did not auto-approve
  - Marcus: inputs stayed local and ephemeral; no staged or remote user-submission tracing

## Cases run

- `simply-elegant-simply-elegant-spirits-distilled-spirits`
- `leitz-rottland-wine`
- `lake-placid-shredder-malt-beverage`
- supplemental generated candidate: `lake-placid-shredder-abv-negative`

## Live asset status

- Required live assets: yes
- Missing live assets: none for the `cola-cloud-real` subset

## Expected vs actual

| Case | Expected | Actual | Latency | Notes |
| --- | --- | --- | --- | --- |
| `simply-elegant-simply-elegant-spirits-distilled-spirits` | `approve` | `review` | not captured | Standalone path skipped application comparisons and kept `government-warning` at `review`. |
| `leitz-rottland-wine` | `approve` | `review` | not captured | Real approved wine still stayed conservative in standalone mode. |
| `lake-placid-shredder-malt-beverage` | `approve` | `reject` | not captured | Live route failed `government-warning` on the checked-in real label. |
| `lake-placid-shredder-abv-negative` | intended `reject` | `reject` | not captured | Deterministic raster edit added `5% ABV`; runtime failed both `alcohol-content` and `abv-format-permitted`. |

## Persona scorecards

- Sarah: stronger demo corpus now exists because the repo includes real approved labels, not only synthetic fixtures.
- Dave: current live behavior is still too conservative to treat approved real labels as automatic passes.
- Jenny: negative candidate gives a clean, explainable deterministic failure for training and regression work.
- Marcus: Kaggle supplement is metadata-only and stays outside the canonical checked-in live subset.
- Janet: no batch-specific signal in this run.

## Privacy and trace notes

- Fixture-only or sanitized inputs: no; checked-in real label assets plus one internally edited derivative were used locally.
- `noPersistence` proof: runtime requests stayed local to the Express app and the checked-in assets are repo fixtures, not user submissions.
- Prompt/provider provenance recorded: yes, at the story and repo policy level; no LangSmith trace export for this run.

## Regressions

- Real approved labels in `cola-cloud-real` do not currently behave like reliable `approve` smoke cases on `/api/review`; two downgraded to `review` and one rejected on warning detection.

## Follow-up

- Add a dedicated live smoke runner that records latency and provider selection for `cola-cloud-real`.
- Promote only verified supplemental negatives into the golden manifest; keep candidate assets outside canonical slices until repeated live runs are stable.
- Use the Kaggle CSVs as a metadata supplement only unless image binaries are added through a separate licensed path.
