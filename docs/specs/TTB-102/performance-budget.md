# Performance Budget

## Story scope

`TTB-102` does not add new network hops or model work. It changes the single-label critical path by making the client render the actual `/api/review` payload and by shaping a standalone seed report on the server when no application data is provided.

## Budget

- client-side result selection helper: under 5 ms
- standalone seed shaping on the server: under 5 ms
- existing `/api/review` stub route budget: under 500 ms total
- product-wide single-label budget remains under 5000 ms end to end

## Measurement method

- run the local API
- submit a representative multipart request with and without application fields
- capture end-to-end wall time for the stub route
- confirm the client performs only local state updates after the payload is returned

## Local measurement

- Local `POST /api/review` seed-route samples remain in the same stub range recorded for `TTB-101`: cold first-hit `41.31 ms`, warm samples `5.65 ms`, `3.06 ms`, `2.22 ms`, `3.95 ms`
- Additional standalone shaping work is synchronous object selection only; no measurable route regression was observed in the story-local test loop
- Result: still far below the story-level stub budget and the product-wide 5-second target

## Notes

- This story still measures the seed-backed route, not the eventual `TTB-205` validator path
- When `TTB-205` lands, replace this story-local timing note with a full integrated single-label measurement
