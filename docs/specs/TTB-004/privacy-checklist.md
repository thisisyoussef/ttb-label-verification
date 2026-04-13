# Privacy Checklist

## Story

- Story ID: `TTB-004`
- Title: accessibility, hardening, and submission pack

## Data surfaces touched

- upload input: single-label and batch uploads
- application input: form fields and batch CSV content
- model request: single-label and batch review calls
- logs: runtime logs, error logs, smoke-test output
- temp files: any remaining upload or export intermediates
- caches: any in-memory or request-scoped state

## Required checks

- `store: false` asserted on model calls: verify in the finished system
- no durable upload storage: verify in the finished system
- no durable temp file writes: verify in the finished system
- no raw sensitive request/response logging: verify in the finished system
- no persistence in caches, queues, or background jobs: verify in the finished system
- response payload does not leak more than intended: verify in the finished system

## Negative verification

- test or inspection proving no persistence:
  - inspect all integrated paths, including batch and export
- test or inspection proving no raw sensitive logging:
  - inspect smoke-test logs and runtime logging paths

## Exceptions

- none expected for final submission
