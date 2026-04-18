# Feature Spec

## Story

- Story ID: `TTB-203`
- Title: extraction adapter, beverage inference, and image-quality assessment

## Problem

The intake path is normalized, but there is no live extraction boundary yet. Downstream validators in `TTB-204` and `TTB-205` need a typed extraction payload that includes field presence, confidence, beverage-type resolution, and image-quality signals without collapsing uncertainty into premature compliance decisions.

## Goals

- Add a live extraction adapter backed by the Responses API and structured outputs.
- Return a typed extraction payload for a single label plus optional application fields.
- Resolve beverage type from application input when present, otherwise infer it with a documented strict fallback.
- Expose image-quality and warning-visual signals that downstream validators can consume directly.

## Non-goals

- Final recommendation aggregation
- Government warning exact-text validation and diff generation
- Field comparison against application data beyond beverage-type selection
- UI redesign or new reviewer-facing visual structure

## Acceptance criteria

1. The server exposes a repeatable extraction path that accepts the same multipart contract as the review route and returns a typed extraction payload.
2. The extraction payload reports field presence, extracted values, and confidences for the baseline label fields needed by later validator stories.
3. Beverage type uses application input when supplied; otherwise it is inferred from extracted content, then falls back conservatively:
   - ambiguous but label-like evidence may still default to distilled spirits
   - no-text or non-label-like evidence stays `unknown` instead of masquerading as distilled spirits
4. Image-quality output includes a numeric score plus explicit low-confidence or no-text states instead of hiding uncertainty.
5. Model calls use the Responses API with `store: false`, no Files API persistence, and no durable temp-file handling.
6. The packet, tests, and eval notes make the extraction layer ready for `TTB-204` and `TTB-205`, even if the six-label live eval remains blocked by missing real label binaries for the live corpus.

## User impact

- Engineering gains a live extraction contract and endpoint for real label analysis.
- The approved UI can remain seeded until later validator and aggregation stories cut over the main review route.
