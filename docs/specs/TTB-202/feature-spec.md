# Feature Spec

## Problem

The review route already accepts a file upload, but the intake logic is still route-local, still treats the `fields` part as mandatory, and does not expose a reusable normalized request shape for downstream extraction work.

## Goals

- Accept a single in-memory label file plus optional application data safely.
- Normalize intake data into a typed server shape that future extraction and validation stories can consume directly.
- Preserve no-persistence guarantees and current structured error semantics.

## Non-goals

- Running extraction or validation logic
- Changing visible UI design
- Adding persistence or telemetry

## Acceptance criteria

1. `POST /api/review` accepts supported file types with or without the multipart `fields` part.
2. Empty strings are normalized as missing values rather than treated as invalid input.
3. Intake normalization is isolated from the route into a reusable server module.
4. Oversize, unsupported-file, and malformed-input failures still map cleanly to structured review errors.
5. No upload path writes to disk or logs sensitive intake payloads.

## User impact

- Image-only review requests no longer depend on a `fields` part being present.
- Existing UI error handling remains unchanged.
