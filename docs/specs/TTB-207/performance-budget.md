# Performance Budget

## Story

- Story ID: `TTB-207`
- Title: Gemini-primary label extraction with OpenAI fallback and cross-provider validation

## Single-label target

- End-to-end target remains under 5 seconds.

## Happy-path budget (`gemini` succeeds)

- request normalization + provider selection: `<= 250 ms`
- in-memory media encoding + request assembly: `<= 150 ms`
- Gemini extraction call: `<= 3000 ms`
- deterministic validation + report shaping: `<= 500 ms`
- serialization + route response margin: `<= 600 ms`

Target subtotal: `<= 4500 ms`

## Fast-fail fallback budget (`gemini` fails quickly, `openai` recovers)

- request normalization + provider selection: `<= 250 ms`
- Gemini fast-fail detection: `<= 500 ms`
- fallback handoff and second-request assembly: `<= 150 ms`
- OpenAI fallback extraction: `<= 3000 ms`
- deterministic validation + report shaping: `<= 500 ms`
- response margin: `<= 400 ms`

Target subtotal: `<= 4800 ms`

## Late-failure rule

If Gemini has already consumed the fast-fail budget and still has not returned, the single-label path must not start a second full extraction call. It should return a structured retryable error instead of exceeding the interactive budget.

## Measurement method

- measure route-level latency for:
  - Gemini-primary success
  - forced Gemini fast-fail with OpenAI recovery
  - forced late Gemini timeout
- record the measurements in the story packet and `evals/results/`
