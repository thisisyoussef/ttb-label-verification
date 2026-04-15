# Feature Spec

## Story

- Story ID: `TTB-209`
- Title: cloud/default Gemini hot-path tuning and latency policy hardening

## Problem statement

The current product-level contract targets a `<= 5,000 ms` single-label path, but the checked-in Gemini default was still configured to time out at `3000 ms` and the real cloud route still varied enough that a `<= 4,000 ms` cutover could not be proved honestly. This story tunes the default Gemini request profile, records the winning and losing latency experiments, checks in a larger image-backed eval slice, and locks the product to a truthful `<= 5,000 ms` baseline instead of claiming an unproved `4000 ms` budget.

## User-facing outcomes

- The default Gemini path uses the best measured profile for this repo: `gemini-2.5-flash-lite`, smart media defaults, Flash-family `thinkingBudget=0`, and no priority tier by default.
- The shipped timeout posture matches the real product budget better than the old `3000 ms` self-fail setting.
- The visible report budget remains truthful at `5000 ms`; the repo does not claim `4000 ms` without proof.

## Acceptance criteria

1. The story records the winning Gemini profile and the losing latency experiments on the approved 20-case image-backed slice.
2. The runtime defaults cut over to the best measured baseline for this repo: `gemini-2.5-flash-lite`, raster `low`, PDF `medium`, Flash-family `thinkingBudget=0`, no priority tier by default, and `GEMINI_TIMEOUT_MS=5000`.
3. The checked-in eval corpus expands beyond the local-only `.tmp` set through `evals/labels/latency-twenty.manifest.json` plus the matching assets under `evals/labels/assets/`.
4. Prompt and request-profile tuning keeps the more accurate `cloud-cross-provider-v1` prompt active because the slimmer prompt did not materially improve route latency.
5. The story packet, eval result, and tracker record the explicit non-cutover decision to keep `latencyBudgetMs` at `5000`.
6. Tests prove the tuned Gemini config, telemetry capture, and eval-manifest validation behavior.

## Edge cases

- clear image vs low-quality image
- PDF vs raster upload
- priority-tier downgrade back to standard processing
- timeout policy too short for the real provider wait distribution
- batch-item execution under the same tuned provider profile
- low-latency model choice improves speed but weakens warning-text fidelity

## Out of scope

- UI redesign or new reviewer-facing evidence fields
- database, queue, or async background processing
- Gemini Files API, Gemini explicit caching, or any other durable provider-side storage workaround
- claiming a `4000 ms` public budget without new measured proof
