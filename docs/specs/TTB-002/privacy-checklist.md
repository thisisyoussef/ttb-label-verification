# Privacy Checklist

## Story

- Story ID: `TTB-002`
- Title: single-label compliance engine and recommendation API

## Data surfaces touched

- upload input: label image or PDF
- application input: optional COLA application fields
- model request: structured extraction request with image content
- logs: server request and error logs
- temp files: upload buffering or PDF/image normalization intermediates
- caches: none expected for request payloads or results

## Required checks

- `store: false` asserted on model calls: required
- no durable upload storage: required
- no durable temp file writes: required unless a truly temporary filesystem step is unavoidable and proven to clean up immediately
- no raw sensitive request/response logging: required
- no persistence in caches, queues, or background jobs: required
- response payload does not leak more than intended: required

## Negative verification

- test or inspection proving no persistence:
  - inspect upload path, filesystem writes, and request lifecycle for durable writes
  - verify no storage adapters, queue writers, or database writes are introduced
- test or inspection proving no raw sensitive logging:
  - inspect log statements for file payloads, extracted full text, or application data dumps
  - add regression tests or targeted assertions where practical

## Exceptions

- none expected for the proof of concept
