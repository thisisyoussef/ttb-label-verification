# Constitution Check

## Story

- Story ID: `TTB-203`
- Title: extraction adapter, beverage inference, and image-quality assessment

## Non-negotiable rules checked

- Responses API with `store: false`: required for every model request in this story.
- Extraction-only first pass: required; the model may extract and classify, but it must not decide compliance outcomes.
- No persistence: required; uploaded assets, application fields, and extraction payloads remain in memory only.
- Uncertainty remains reversible: required; low-confidence extraction and visual ambiguity must stay explicit so downstream validators can return `review`.
- Approved UI preserved: required; this story may add extraction plumbing and internal APIs, but it does not redesign the `TTB-102` UI.

## Exceptions

- None.
