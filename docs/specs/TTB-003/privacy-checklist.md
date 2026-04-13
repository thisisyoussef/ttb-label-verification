# Privacy Checklist

## Story

- Story ID: `TTB-003`
- Title: batch triage workflow and processing pipeline

## Data surfaces touched

- upload input: many label files plus one CSV
- application input: CSV-provided application fields
- model request: repeated single-label extraction calls
- logs: batch-level progress and item failures
- temp files: any batch staging needed for matching or PDF/image normalization
- caches: none expected for persistent batch state

## Required checks

- `store: false` asserted on all model calls: required
- no durable upload storage: required
- no durable temp file writes: required
- no raw sensitive request/response logging: required
- no persistence in caches, queues, or background jobs: required
- response payload does not leak more than intended: required

## Negative verification

- test or inspection proving no persistence:
  - inspect batch staging and matching implementation for durable writes
  - verify reviewed/confirmed status is session-scoped only
- test or inspection proving no raw sensitive logging:
  - ensure CSV contents, extracted text, and raw item payloads are not dumped in logs

## Exceptions

- none expected for the proof of concept
