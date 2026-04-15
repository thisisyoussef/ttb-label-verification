# Feature Spec

## Story

- Story ID: `TTB-302`
- Title: live-first batch runtime, workflow cleanup, and fixture demotion
- Parent: `TTB-003`

## Problem

The batch feature is implemented across client and server, but the shipped runtime still feels like a seeded demo because core client state initializes from fixture batches and fixture stream states. That weakens trust in the feature even when the live server session path works.

The product goal for this story is not to add new batch capabilities. It is to make the existing batch capabilities operate as a coherent, live-first workflow that a reviewer can trust in staging and in the final submission.

## Users

- `Janet` needs a first-class batch review flow that feels real, not simulated.
- `Dave` needs batch to behave predictably without requiring mental model switches between “demo” and “live”.
- `Marcus` needs the no-persistence posture to remain explicit even as the workflow becomes more realistic.

## Acceptance criteria

1. Batch intake initializes as a live workflow by default in normal runtime.
2. Fixture batches and seeded stream/dashboard states remain available only behind explicit fixture-mode controls.
3. Starting a batch from the intake surface in normal runtime always uses real preflight and run requests.
4. Dashboard, drill-in, retry, and export in normal runtime always derive from real batch session responses instead of scenario seeds.
5. Batch cancellation, retry, and export failure states remain understandable and actionable.
6. The batch client state model is simplified so live intake/preflight, run/stream, and dashboard/drill-in concerns are separated clearly enough to maintain without depending on seed-derived state.
7. Approved `TTB-103` and `TTB-104` UI constraints remain intact.
8. The no-persistence batch posture remains true and visible in the runtime and docs.
9. A reviewer can exercise one full live batch flow and one non-happy-path branch locally using a concrete manual script.

## Out of scope

- Net-new batch screen concepts or visual redesigns.
- Cross-session persistence, background jobs, or durable workflow queues.
- New model prompt or validator behavior unrelated to the batch runtime path.
- Release-pack documentation beyond the batch-specific updates required to reflect this story.
