# Privacy Checklist

## Story

- Story ID: `TTB-203`
- Title: extraction adapter, beverage inference, and image-quality assessment

## Checks

- [x] Model calls assert `store: false`.
- [x] Label images and PDFs remain in memory only; no durable temp files are introduced.
- [x] The adapter does not use the Files API or any other durable upload surface.
- [x] No raw label bytes, full extracted text dumps, or application payloads are written to logs.
- [x] Structured error responses avoid echoing sensitive payload content.

## Negative verification

- Inspect the adapter request builder and server entrypoint for durable file writes or file IDs.
- Inspect new error handling and test output paths for payload leakage.
- Verify the extraction contract carries bounded typed fields rather than raw multipart internals.

## Notes

- Verified 2026-04-13 against `src/server/index.ts`, `src/server/extractors/openai-review-extractor.ts`, `src/server/extractors/review-extraction.ts`, and the corresponding test files.
- The adapter packages PDFs as Base64 `input_file` data URLs and images as Base64 `input_image` data URLs, which keeps uploads in memory and avoids durable file IDs.
- Config-failure coverage is carried by route and adapter tests that exercise the unconfigured-env path; the structured adapter error does not echo payload content.
