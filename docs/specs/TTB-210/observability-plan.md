# Observability Plan

## Goal

Keep the internal relevance preflight diagnosable without surfacing a pre-submit gate and without logging raw uploads or OCR text.

## Server signals

- `/api/review/relevance` returns `X-Stage-Timings`
  - includes `intake-parse`
  - includes `intake-normalization`
  - includes `relevance-preflight`

## Privacy rules

- no raw OCR text in logs
- no raw filenames or bytes in the relevance payload
- no durable cache beyond the existing in-memory extract-only cache
