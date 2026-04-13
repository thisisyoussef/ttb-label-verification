# Privacy Checklist

## Story

- Story ID:
- Title:

## Data surfaces touched

- upload input:
- application input:
- model request:
- logs:
- temp files:
- caches:

## Required checks

- `store: false` asserted on model calls:
- no durable upload storage:
- no durable temp file writes:
- no raw sensitive request/response logging:
- no persistence in caches, queues, or background jobs:
- response payload does not leak more than intended:

## Negative verification

- test or inspection proving no persistence:
- test or inspection proving no raw sensitive logging:

## Exceptions

- none / explicit rationale:
