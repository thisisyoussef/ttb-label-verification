# Trace Brief

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## Hypothesis

A shared extraction baseline plus small endpoint overlays and structural guardrails will improve reviewer trust and endpoint consistency without adding material latency to the single-label path.
The current follow-up hypothesis is narrower: when a strong literal anchor says
the approved field value is clearly on the label, that top-down signal should
take priority for the field row even if the bottom-up read is contradictory,
while the overall verdict still depends on the rest of the report.

## Fixture slice

- start with:
  - `G-01` clean approval baseline
  - `G-02` warning defect
  - `G-03` cosmetic mismatch
  - `G-06` low-quality image
  - one standalone case from the standalone slice
  - one repeated batch item pair from the batch slice
- expand to the live core-six subset only when the required assets are present

## Review focus

- field presence and abstention discipline
- warning-text completeness and punctuation fidelity
- confidence/note usefulness for low-quality cases
- cross-endpoint consistency for the same uploaded label
- latency impact of overlay and guardrail logic

## Failure taxonomy

- `hallucination`: extracted value appears sourced from application data or unsupported inference
- `warning-drift`: warning route or prompt overlay captures weaker text than the review route
- `false-certainty`: sparse extraction preserved as strong success
- `guardrail-overreach`: valid missing-field evidence converted into adapter failure
- `batch-inconsistency`: repeated item behavior drifts in batch
- `prompt-bloat`: latency increase caused by prompt/guardrail additions
- `anchor-overreach`: literal anchor priority clears a field row that should
  still be blocked by a real label defect elsewhere

## Decision record

- compare:
  - shared baseline only
  - shared baseline + endpoint overlays
  - shared baseline + endpoint overlays + structural guardrails
- winning local implementation:
  - shared baseline + endpoint overlays + structural guardrails
  - review route profile: `review-extraction/review-cloud-v1`
  - extraction route profile: `review-extraction/extraction-cloud-v1`
  - warning route profile: `review-extraction/warning-cloud-v1`
  - batch route profile: `review-extraction/review-cloud-v1` via the batch run/retry surfaces
  - guardrail policy: `review-extraction/structural-guardrails-cloud-v1`
- winning local behavior:
  - route and batch surfaces now resolve prompt policy centrally from endpoint surface + extraction mode, with batch item execution pinned to the canonical `review` overlay
  - contradictory no-text outputs are sanitized into explicit uncertainty instead of surfacing fake certainty
  - warning-absent outputs preserve absence while downgrading unsupported warning-signal certainty
  - local-mode overlays and guardrails now downgrade formatting/spatial claims instead of promoting them
- local evidence:
  - `npm run eval:golden`
  - route-level spot checks against `/api/review/relevance`
  - `X-Stage-Timings` headers and existing latency-focused tests
- local anchor-priority follow-up evidence:
  - `npx vitest run src/server/review-report-anchor-merge.test.ts src/server/review-pipeline.e2e.test.ts`
  - `NODE_ENV=test npx tsx -e <fast-slice anchor stress A/B>` comparing `ANCHOR_MERGE=disabled` vs `enabled` on real labels with a hostile extractor stub
  - winning stress-run result: fast-slice correctness improved from `1/7` to
    `2/7`, field passes improved from `10` to `20`, review rows dropped from
    `22` to `12`, fail rows held at `2`, `harpoon` improved from `review` to
    `approve`, and `negative-abv` stayed `reject`
- remaining persona tradeoffs:
  - none observed in fixture-backed evals
  - no external trace publication is required after the external trace dependency removal
  - `npm run eval:golden` still carries the pre-existing `G-02:warning`
    warning-route failure; the literal-anchor follow-up did not change it
