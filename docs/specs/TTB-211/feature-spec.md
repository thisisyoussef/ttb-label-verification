# Feature Spec

## Story

- Story ID: `TTB-211`
- Title: LLM endpoint and mode eval matrix, persona scorecards, and trace regression gates

## Problem statement

The current eval harness is corpus-first, which is necessary, but it is not yet endpoint-aware, mode-aware, or persona-aware. A change can pass the core-six overall and still regress the actual product experience:

- Dave can see noisier overcalling in the review route.
- Jenny can lose evidence completeness in the extraction route.
- Sarah can get inconsistent demo behavior between review and warning paths.
- Marcus can lose confidence because prompt/trace artifacts do not prove privacy-safe behavior.
- Janet can absorb batch inconsistency that single-label evals never measure.
- Marcus can be promised a local deployment path without any checked-in evidence about what local mode actually changes.

The repo needs an eval model that scores the model-backed endpoints the way users experience them, not only the way the extractor schema parses.

## User-facing outcomes

- Product claims about reviewer trust, batch consistency, privacy posture, and cloud-vs-local tradeoffs become measurable.
- Endpoint regressions become easier to catch before they hit a demo or release gate.
- Trace reviews become comparable across providers, prompt profiles, route surfaces, and extraction modes.

## Acceptance criteria

1. The checked-in eval model enumerates every current model-backed endpoint and extraction mode combination the product supports.
2. The golden eval set, eval docs, or both can select the smallest applicable slice by endpoint surface, extraction mode, and corpus theme.
3. Persona scorecards exist for:
   - Sarah
   - Dave
   - Jenny
   - Marcus
   - Janet
4. The eval run template records:
   - endpoint surface
   - extraction mode
   - provider
   - prompt profile or prompt-policy version
   - guardrail policy version
   - latency notes
   - persona-specific observations
5. Trace review guidance records endpoint, extraction mode, and prompt-profile identity alongside trace ids so repeated runs remain comparable.
6. `TTB-401` release work explicitly depends on the latest endpoint-aware and mode-aware LLM eval evidence instead of only the generic six-label baseline.

## Out of scope

- changing the approved UI
- replacing deterministic validators with model scoring
- adding new model-backed endpoints beyond the current route graph
