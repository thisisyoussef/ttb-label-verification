# Privacy Checklist

## Story

- Story ID: `TTB-302`
- Title: live-first batch runtime, workflow cleanup, and fixture demotion

## Checklist

- [x] Batch uploads remain in memory only.
- [x] Batch CSV data remains in memory only.
- [x] Batch session results remain in memory only.
- [x] Export is generated on demand and not persisted.
- [x] No new durable storage, queue, cache, or temp-file behavior is introduced.
- [x] Logs and failure messages stay privacy-safe and do not dump raw inputs.
- [x] The visible privacy anchor remains accurate after the runtime cleanup.

## Verification note

- `src/server/routes/register-batch-routes.ts` now marks preflight, run, cancel, summary, report, export, and retry responses as `cache-control: no-store`.
- Local browser verification on 2026-04-15 confirmed the batch privacy copy still renders on intake, processing, terminal, and dashboard surfaces.
