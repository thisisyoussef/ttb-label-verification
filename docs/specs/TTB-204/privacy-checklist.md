# Privacy Checklist

## Story

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence

## Checks

- [x] Uses the existing in-memory multipart upload path from `TTB-202`
- [x] Reuses the existing Responses API extraction call with `store: false`
- [x] Does not introduce durable Files API uploads
- [x] Does not create temp files for warning validation or diff generation
- [x] Does not add raw request or raw image logging
- [x] Returns only structured warning evidence needed by the client contract

## Notes

- `POST /api/review/warning` is a staging route, not a persistence surface.
- The warning validator operates only on the already-typed extraction payload and does not write any intermediate state.
