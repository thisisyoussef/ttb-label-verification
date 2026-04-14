# Privacy Checklist

## Story scope

`TTB-101` adds a stub multipart review route behind the approved intake UI. The route validates the request and returns the existing seed report. No model calls or persistent storage are introduced.

## Checks

- [x] Upload data is processed in memory only; no disk-backed upload directory is introduced
- [x] Rejected uploads are not written to temp files, caches, or durable storage
- [x] No request handler logs raw filenames, label contents, OCR text, or submitted field values
- [x] The route does not introduce analytics, telemetry, or browser storage
- [x] Existing no-persistence health contract remains intact
- [x] Future Responses API work remains explicitly deferred; no model call is added in this story

## Verification notes

- Multipart middleware must be route-local to `POST /api/review`
- Limits must reject oversized payloads before downstream processing
- Error responses must be plain-English and must not echo submitted data back to logs
- Implemented with route-local `multer.memoryStorage()` plus explicit size/count limits

## Negative cases to prove

- Unsupported file type returns a structured error without any disk artifact
- Oversized file returns a structured error without any disk artifact
- Malformed `fields` JSON returns a structured error without processing the upload further

## Local proof

- `src/server/index.test.ts` covers supported upload, unsupported MIME, oversized file, malformed `fields` JSON, and missing-file cases
- `npm run test`, `npm run typecheck`, and `npm run build` all passed on 2026-04-13 after the route was added
