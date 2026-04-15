# Trace Brief

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## Hypothesis

A shared extraction baseline plus small endpoint overlays and structural guardrails will improve reviewer trust and endpoint consistency without adding material latency to the single-label path.

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
  - batch route profile: `review-extraction/batch-cloud-v1`
  - guardrail policy: `review-extraction/structural-guardrails-cloud-v1`
- winning local behavior:
  - route and batch surfaces now resolve prompt policy centrally from endpoint surface + extraction mode
  - contradictory no-text outputs are sanitized into explicit uncertainty instead of surfacing fake certainty
  - warning-absent outputs preserve absence while downgrading unsupported warning-signal certainty
  - local-mode overlays and guardrails now downgrade formatting/spatial claims instead of promoting them
- attempted traced evidence:
  - direct route-surface probe root id: `019d8f14-2b7c-7000-8000-00a681dfeb29`
  - nested extraction span id: `019d8f14-2b81-7000-8000-034d26f75baa`
- current blocker:
  - `LANGSMITH_TRACING=true LANGSMITH_TEST_TRACKING=true npm run eval:golden` fails with `401 Unauthorized` on `/datasets`
  - direct traced probe generates local trace ids but upload returns `403 Forbidden`
- remaining persona tradeoffs:
  - none observed in fixture-backed evals
  - external trace publication is still blocked by LangSmith auth, so the story cannot yet record a published winning trace set
