# Observability Plan

## Story

- Story ID: `TTB-208`
- Title: cloud/default latency observability and sub-4-second budget framing

## Goal

Make the single-label cloud path diagnosable at the stage level without changing the approved UI
contract and without recording any sensitive request content.

## Capture surfaces

- `POST /api/review`
- `POST /api/review/extraction`
- `POST /api/review/warning`
- per-item batch execution for `POST /api/batch/run`
- per-item batch execution for `POST /api/batch/retry`

## Required summary fields

Every latency summary must capture:

- `surface`
- outcome path:
  - `primary-success`
  - `fast-fail-fallback-success`
  - `late-fail-retryable`
  - `primary-hard-fail`
  - `pre-provider-failure`
  - `fallback-failure` when applicable
- total duration in milliseconds
- ordered stage spans with:
  - stage id
  - attempt id when relevant (`primary` or `fallback`)
  - provider id when relevant
  - outcome class (`success`, `fast-fail`, `late-fail`, `skipped`)
  - duration in milliseconds
- configured provider order
- whether fallback was attempted
- `clientTraceId` when present
- `fixtureId` when present

## Required stage coverage

The measurement model must be able to record:

- intake parse
- intake normalization
- provider selection
- request assembly
- provider wait
- fallback handoff
- deterministic validation
- report shaping
- total duration

## Failure branches to keep explicit

- upload/validation failure before any provider call
- extractor unavailable before provider selection can succeed
- primary provider success
- retryable primary provider failure with fallback success
- retryable primary provider failure after the fallback budget is already spent
- non-retryable primary provider failure
- fallback provider failure after a fast primary failure
- batch cancellation after some items have already completed

## Privacy guardrails

Do not record:

- raw image or PDF bytes
- raw application values
- filenames or file paths
- base64 payloads
- provider request or response bodies

Allowed timing metadata:

- provider ids
- stage ids
- attempt ids
- bounded duration numbers
- bounded outcome classes
- surface ids
- correlation ids already approved for traces and fixtures

## Diagnostics path

- Tests should capture summaries through an in-memory observer passed into `createApp()` or the
  traced route helpers.
- Eval harnesses should capture the same summaries and store only the safe categorical plus numeric
  fields in `evals/results/`.
- Local manual diagnostics may be enabled through a debug-only observer or environment flag, but
  must print only the safe summary shape.

## Verification targets

- Unit coverage proves span ordering, rounded durations, fallback detection, and safe summary
  structure.
- Route-level coverage proves primary-success, fast-fail fallback, late-fail retryable, and
  pre-provider-failure branches on the public endpoints without changing their payloads.
- Batch coverage proves one safe timing summary is emitted per completed item.
