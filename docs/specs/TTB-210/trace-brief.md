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
- record the winning configuration, trace ids, and any remaining persona tradeoffs here during implementation
