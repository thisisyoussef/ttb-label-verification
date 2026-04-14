# Privacy Checklist

## Story

- Story ID: `TTB-202`
- Title: single-label upload intake, normalization, and ephemeral file handling

## Checks

- [x] Uploads stay in memory only (`multer.memoryStorage()`), with no disk-backed temp files.
- [x] No raw label image bytes, application fields, or normalized intake values are written to logs.
- [x] Missing or malformed multipart data returns structured errors only; it does not echo back sensitive payload content.
- [x] The route performs validation before any future model call boundary.
- [x] No storage, cache, queue, or analytics behavior is introduced.

## Negative verification

- Route tests cover omitted `fields`, malformed `fields`, unsupported file types, oversized files, and missing file uploads.
- Intake normalization emits a bounded typed object that contains buffer metadata only, not file-system paths.

## Notes

- Verified 2026-04-13 against `src/server/index.ts`, `src/server/review-intake.ts`, `src/server/index.test.ts`, and `src/server/review-intake.test.ts`.
- The normalized intake shape now keeps only in-memory buffer metadata (`originalName`, `mimeType`, `bytes`, `buffer`) plus normalized application fields; it does not expose `path`, `filename`, or `destination`.
- OpenAI `store: false` remains a future extraction-story requirement; this story does not invoke the model layer.
