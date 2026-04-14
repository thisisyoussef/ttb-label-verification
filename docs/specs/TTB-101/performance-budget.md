# Performance Budget

## Story scope

`TTB-101` does not add live extraction or validator work. Its critical-path budget covers request parsing, upload validation, and the stub response returned by `POST /api/review`.

## Budget

- multipart parsing and Zod validation: under 250 ms for a normal single-file request
- server response shaping: under 100 ms
- total route time for the stub review path: under 500 ms
- product-level single-label budget remains under 5000 ms end to end

## Measurement method

- run the local API
- submit a representative multipart request with one supported file and valid `fields`
- capture end-to-end wall time with a local client request
- record the result below

## Local measurement

- Local `POST /api/review` samples on 2026-04-13: `41.31 ms`, `5.65 ms`, `3.06 ms`, `2.22 ms`, `3.95 ms`
- Warm-route median: `3.95 ms`
- Cold first-hit sample: `41.31 ms`
- Result: well within the story-level stub budget and far below the product-wide 5-second target

## Notes

- This story intentionally measures only the stub route overhead
- Live model and validator timing remains for later `TTB-20x` stories
