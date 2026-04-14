# Eval Brief

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## AI behavior being changed

This story changes prompt wording, endpoint-specific extraction intent, and post-parse guardrail behavior across every current model-backed route.

## Expected gain

- lower false certainty on ambiguous or weak extractions
- stronger warning-text fidelity for the showcase warning path
- more stable extraction behavior between `/api/review`, `/api/review/extraction`, `/api/review/warning`, and batch item execution
- user-centered extraction behavior that can be explained in terms of reviewer trust, not just schema compliance

## Failure modes to catch

- hallucinated field values that mirror application inputs instead of label evidence
- warning route captures weaker warning text or punctuation than the main review route
- sparse extractions are treated as successful high-confidence payloads
- guardrails incorrectly convert valid missing-warning evidence into adapter failure
- batch items drift inconsistently between repeated runs or endpoint contexts
- prompt bloat creates measurable latency regression

## Eval inputs or dataset slice

- approved local fixture slice covering:
  - one clean comparison case
  - one warning-text defect
  - one cosmetic mismatch
  - one low-quality case
  - one standalone case
  - one batch-consistency pair
- live core-six subset when label assets are available

## Persona score focus

- Sarah: stable demo behavior and no contradiction between endpoints
- Dave: no obvious overcalling on cosmetic or uncertain cases
- Jenny: complete evidence and usable confidence/note quality
- Marcus: privacy-safe prompt discipline and failure notes
- Janet: item-local batch degradation and repeated-run consistency

## Pass criteria

- route tests prove centralized prompt-policy usage across all current LLM endpoints
- traces identify a winning prompt-profile and guardrail policy with no user-hostile regressions on the approved slice
- latency measurements stay within the active single-label budget
- eval notes explicitly call out any persona tradeoff that remains open
