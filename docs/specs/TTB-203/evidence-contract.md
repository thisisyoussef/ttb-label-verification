# Evidence Contract

## Story

- Story ID: `TTB-203`
- Title: extraction adapter, beverage inference, and image-quality assessment

## Surface introduced

- API route: `POST /api/review/extraction`
- Shared contract file: `src/shared/contracts/review.ts`
- Downstream consumers:
  - `TTB-204` government warning validation
  - `TTB-205` field comparison, recommendation aggregation, and full `POST /api/review` cutover

## Extraction payload requirements

- top-level metadata:
  - extraction ID
  - model name
  - resolved beverage type
  - beverage-type source
  - standalone flag
  - no-persistence marker
- field evidence:
  - `present`
  - extracted `value` when available
  - `confidence`
  - optional note for ambiguity or legibility limits
- warning visual evidence:
  - all-caps prefix signal
  - bold-prefix signal
  - continuous-paragraph signal
  - separate-from-other-content signal
  - confidence and note per signal
- image-quality evidence:
  - normalized score from `0` to `1`
  - extraction-quality state (`ok`, `low-confidence`, `no-text-extracted`)
  - issue notes for blur, glare, darkness, rotation, cut-off text, or similar limits

## Compatibility notes

- `POST /api/review` remains seeded during this story; the extraction contract is the staging input for later validator stories.
- The extraction payload must stay serializable and must not include filesystem paths, durable file IDs, or raw request dumps.
