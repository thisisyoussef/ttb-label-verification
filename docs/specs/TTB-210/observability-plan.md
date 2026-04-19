# Observability Plan

## Goal

Make the quick relevance branch easy to diagnose without logging raw uploads or OCR text.

## Client events

- `review.relevance.gated`
  - emitted when Verify is paused because the quick scan returned `unlikely-label`
- `review.relevance.override`
  - emitted when the reviewer chooses `Continue anyway`

## Server signals

- `/api/review/relevance` returns `X-Stage-Timings`
  - includes `intake-parse`
  - includes `intake-normalization`
  - includes `relevance-preflight`

## Privacy rules

- no raw OCR text in logs
- no raw filenames or bytes in the relevance payload
- no durable cache beyond the existing in-memory extract-only cache
