# Feature Spec

## Story

- Story ID: `TTB-EVAL-002`
- Title: Gemini Batch golden-set live eval runner and cost discipline

## Problem statement

The repo already has two eval layers:

- a fixture-backed golden gate for deterministic route coverage
- live corpus runners for approved image-backed Gemini extraction work

The live runners currently spend standard interactive Gemini cost even when the work is a non-urgent corpus sweep. For approved local eval assets, Gemini Batch is a better fit: cheaper, high-throughput, and asynchronous. The repo needs an opt-in Batch runner for the live extraction corpus without weakening the privacy posture or replacing the canonical fixture gate.

## User-facing outcomes

- Engineers can run approved live Gemini extraction benchmarks against the checked-in corpus at lower cost.
- The repo keeps the privacy boundary explicit: Batch is only for approved checked-in eval assets, never reviewer submissions.
- Golden/live eval docs now distinguish the canonical gate from the cost-optimized live corpus path.

## Acceptance criteria

1. The repo contains an opt-in script that submits approved live extraction corpus cases to Gemini Batch using inline requests.
2. The runner refuses corpus selections that would require Gemini Files API or exceed the inline Batch size ceiling.
3. The runner reuses the existing Gemini extraction request shape and schema normalization rather than inventing a second prompt or output contract.
4. The runner writes a local machine-readable result artifact with per-case outputs, parse failures, and aggregate field metrics.
5. The runner can delete the completed batch job after result capture.
6. The docs make these boundaries explicit:
   - fixture-backed `npm run eval:golden` remains canonical
   - Gemini Batch is live-eval tooling only
   - approved checked-in assets only
   - no Files API path in this story
7. Tests cover request assembly, size-guard enforcement, and batch-result parsing.

## Edge cases

- The selected corpus is too large for inline Batch.
- A case asset is missing on disk.
- Gemini returns a per-request batch error while the overall job succeeds.
- Gemini returns malformed JSON for one case.
- A result payload parses as Gemini output but fails the repo schema.

## Out of scope

- Product runtime routes
- Batch API file-upload mode
- Vertex batch prediction
- Replacing the fixture-backed golden gate
