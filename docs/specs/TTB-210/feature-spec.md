# Feature Spec

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## Problem statement

The current extraction path uses one generic prompt string for every model-backed route, and the planned dual-mode architecture will add a second execution boundary (`cloud` vs `local`) with different capability strengths. That keeps the implementation simple today, but it leaves the product without an explicit way to encode the reviewer promises the app is making:

- Dave needs the route to avoid dumb false certainty and obvious overcalling.
- Jenny needs complete, well-explained evidence and uncertainty that is actually usable.
- Sarah needs stable, demo-friendly behavior that does not drift between endpoints.
- Marcus needs privacy-safe prompt discipline and failure behavior that can be documented.
- Janet needs batch consistency and item-local degradation rather than noisy session-wide instability.

Without a shared prompt policy and endpoint-aware plus mode-aware guardrails, provider work can succeed technically while still producing user-hostile behavior on `/api/review`, `/api/review/extraction`, `/api/review/warning`, or the batch engine.

## User-facing outcomes

- Single-label review becomes less likely to overstate certainty on ambiguous labels.
- Extraction-only and warning-only paths become more consistent with the full review route instead of feeling like separate products.
- Batch execution handles weak or sparse extractions in a way that protects Janet's queue instead of amplifying noise.
- The product can explain its prompt/guardrail posture to Marcus and leadership as an intentional reviewer-safety layer, not just a model string.

## Acceptance criteria

1. The server has a shared prompt-policy module with one base extraction instruction set plus:
   - endpoint overlays for:
     - `review`
     - `extraction`
     - `warning`
     - `batch`
   - mode overlays for:
     - `cloud`
     - `local`
2. The base prompt policy explicitly forbids:
   - final compliance judgment
   - guessing unsupported field values
   - copying label facts from application inputs
   - silently omitting low-confidence ambiguity
3. Endpoint overlays reflect the user goal of each route:
   - `review`: balanced extraction for reviewer trust and downstream comparison
   - `extraction`: richest field coverage and notes without changing the typed contract
   - `warning`: maximum fidelity on government warning text and warning visual signals
   - `batch`: consistency, concise item-level degradation, and no session-wide noise inflation
4. Mode overlays reflect the execution-mode reality:
   - `cloud`: maximize accurate field and visual-signal coverage without overcalling
   - `local`: preserve text extraction, prefer abstention on weak formatting/spatial judgments, and never up-rank unsupported visual reasoning
5. A shared guardrail layer normalizes structural extraction failures and suspicious outputs before routes treat them as successful extraction, including:
   - schema-refusal or sparse required blocks
   - impossible field/value combinations
   - missing warning-signal blocks on warning-sensitive calls
   - unsafe high-confidence hallucination patterns
6. `/api/review`, `/api/review/extraction`, `/api/review/warning`, and batch item processing all resolve prompt policy and guardrails through the same central path instead of embedding route-local prompt strings.
7. Tests prove non-default submitted values survive through the route boundary and that partial or hallucinated model outputs degrade to explicit uncertainty or structured error rather than fake certainty.
8. Trace and eval artifacts record the winning prompt-profile and guardrail thresholds against the approved fixture slice before this story is considered complete.
9. The additional prompt and guardrail overhead stays within the active cloud/default single-label latency target.

## Edge cases

- A high-quality label appears to omit the government warning entirely. The route must preserve that as valid extraction evidence, not auto-upgrade it into an adapter error.
- A low-quality label produces sparse output. The route should expose reversible uncertainty instead of manufacturing a strong result.
- A decorative art upload or other non-label image produces sparse extraction. Auto-detect must keep the beverage type `unknown` unless there is trustworthy alcohol-label evidence.
- The same label is processed through the review route and warning-only route. Prompt overlays may differ, but the extraction contract and user-facing trust posture must stay consistent.
- The same label is processed in cloud mode and local mode. Mode overlays may differ, but the contract and trust posture must remain consistent.
- Batch items from the same importer drift across repeated runs. The route should surface item-local instability clearly rather than polluting the full session.

## Out of scope

- UI changes or new reviewer-facing evidence components
- replacing deterministic validators with model reasoning
- adding new provider types or non-extraction AI capabilities
