# Privacy Checklist

- [x] keep single and batch uploads in memory only
- [x] do not persist primary or secondary images, filenames, or report payloads
- [x] preserve `store: false` on all OpenAI Responses API paths
- [x] avoid raw image bytes, object URLs, or label filenames in durable logs
- [x] revoke any client preview object URLs created for the second image with the same discipline as the primary image
- [x] confirm batch export still contains only session-scoped results and metadata the product already exposes

## 2026-04-18 notes

- single review upload still routes through in-memory multer handling and normalized in-memory intake objects
- batch session state remains process-memory only while carrying primary plus optional secondary image metadata
- OpenAI extraction continues to set `store: false`
- `useSingleReviewFlow` now revokes secondary-image object URLs on replace, clear, reset, and unmount
