# Feature Spec

## Story

- Story ID: `TTB-207`
- Title: Gemini-primary label extraction with OpenAI fallback and cross-provider validation

## Problem statement

The live extraction boundary is hard-wired to OpenAI. That makes the product dependent on one provider for image/document understanding and blocks the requested migration to Gemini-first multimodal extraction with OpenAI fallback.

## User-facing outcomes

- Single-label review, warning validation, and batch execution share a Gemini-primary extraction path.
- When Gemini fast-fails or is unavailable, OpenAI can recover the request without a route rewrite.
- The extraction payload and downstream deterministic validators stay stable while provider choice becomes more resilient.

## Acceptance criteria

1. `POST /api/review`, `POST /api/review/extraction`, `POST /api/review/warning`, and the batch engine all resolve label extraction through the provider router with `label-extraction` ordered as `gemini,openai`.
2. The Gemini extraction adapter uses the native Google GenAI path with structured JSON output and inline image/PDF bytes from memory only.
3. The Gemini output normalizes into the existing `ReviewExtraction` contract so downstream validators and the approved UI do not require redesign.
4. OpenAI fallback is allowed only for explicitly retryable provider failures. Privacy-policy failures, unsupported-capability mismatches, and deterministic normalization bugs fail closed.
5. Single-label fallback is budget-aware: only fast failures can trigger a second provider call. Late timeouts return a structured retryable error instead of chaining a second full extraction pass and blowing the latency budget.
6. Route and batch tests prove both the Gemini-primary path and the OpenAI fallback path using non-default submitted values.
7. Trace/eval work records whether Gemini meets or beats the current OpenAI path on the approved fixture slice before the default is declared production-ready.
8. The final packet records the winning Gemini model choice and any rollback condition if the first candidate does not satisfy quality or latency.

## Edge cases

- Gemini key missing in local or deployment envs
- Gemini returns structured JSON that parses but produces weaker field coverage than OpenAI
- Gemini responds too slowly for an interactive fallback chain
- PDF input works on OpenAI but drifts on Gemini unless prompt/schema guidance is tightened
- Batch item fallback works, but repeated fallback storms threaten rate limits

## Out of scope

- Replacing OpenAI for capabilities that do not exist yet in this repo
- UI changes or new reviewer-facing evidence fields
- Allowing Gemini Files API or long-lived provider-side storage as a workaround
