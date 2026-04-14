# Privacy Checklist

- [x] Batch uploads remain in memory only; no files are written to durable storage.
- [x] Batch session data lives in an in-memory session store keyed by ephemeral `batchSessionId`.
- [x] Export output is generated on demand from the in-memory session and marked `noPersistence: true`.
- [x] Dashboard and drill-in endpoints expose no operator ids, audit ids, or timestamps.
- [x] OpenAI-backed item processing still uses the same no-persistence contract as single-label review.
- [x] Local live smoke confirmed session summary/export work without any restore path after page reload.

## Negative cases checked

- Missing or malformed batch requests return validation errors instead of partial persisted state.
- Retrying an errored row reuses the in-memory session only; it does not create a durable retry record.
