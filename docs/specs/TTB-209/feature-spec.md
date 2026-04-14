# Feature Spec

## Story

- Story ID: `TTB-209`
- Title: cloud/default single-label hot-path optimization to `<= 4 seconds`

## Problem statement

The current product-level contract and existing provider cutover plans still target a `<= 5,000 ms` single-label path. The repo also already contains a warning-route spot check at `7632 ms`, which shows the extraction leg can miss even the old target. The system needs explicit hot-path optimization work to bring real response times down to `<= 4,000 ms`.

## User-facing outcomes

- The normal single-label review path returns within `4 seconds` on the approved latency fixture slice.
- Slow primary-provider failures do not drag the user into a long fallback chain; they fail fast with a retryable error when the remaining budget is insufficient.
- The visible report budget matches the measured target instead of advertising a stale `5000 ms` ceiling.

## Acceptance criteria

1. The optimized `POST /api/review` happy path completes within `<= 4,000 ms` on the approved release-signoff fixture slice.
2. `POST /api/review/extraction` and `POST /api/review/warning` remain at or below the same target envelope and should normally beat the full review route.
3. Deadline-aware fallback prevents a second full provider call when the remaining budget cannot support it; the late-fail path returns a structured retryable error inside the target window.
4. The story evaluates and records the winning primary Gemini profile and the winning OpenAI fallback profile for the latency-sensitive path.
5. Prompt/schema/request-shape work removes unnecessary latency sources and keeps static content structured for cache friendliness without depending on durable provider-side storage.
6. Optional priority-tier and media-resolution tuning remain config-gated and are enabled only if they improve latency without breaking privacy, quality, or cost expectations.
7. After measured proof exists, the shared contract, report builder, and seed fixtures cut over `latencyBudgetMs` from `5000` to `4000`.
8. Tests prove non-default submitted values still survive both the optimized primary path and the allowed fallback path.

## Edge cases

- clear image vs low-quality image
- PDF vs raster upload
- priority-tier downgrade back to standard processing
- cache miss vs repeated static-prefix request
- batch-item execution under the same tuned provider profile
- low-latency model choice improves speed but weakens warning-text fidelity

## Out of scope

- UI redesign or new reviewer-facing evidence fields
- database, queue, or async background processing
- Gemini Files API, Gemini explicit caching, or any other durable provider-side storage workaround
