# Story Packet

## Metadata

- Story ID: `TTB-401`
- Title: final privacy, performance, eval, and submission pack
- Parent: `TTB-004`
- Primary lane: Codex
- Packet mode: compact planning packet

## Constitution check

- Release-gate story.
- Must verify, not assume, privacy and latency behavior.
- Must produce final docs and eval artifacts grounded in the actual build.
- Must preserve the approved UI.

## Feature spec

### Problem

The product is not done when the features exist. It is done when the finished system is measurable, documented, and demonstrably safe for the intended proof-of-concept use.

### Acceptance criteria

- Final privacy verification proves no persistence and `store: false` behavior.
- Final timing proof covers the single-label path against the active post-hardening latency target.
- Final eval artifacts cover the six-label baseline and one representative batch run.
- README and submission-facing docs match the actual product behavior and limitations.

## Technical plan

- Use the parent hardening packet plus real implementation evidence from prior stories.
- Update `README.md`, `evals/results/`, and any supporting architecture notes.
- Close remaining rule-source, privacy, and performance gaps before final handoff, including the tightened latency target once `TTB-208` and `TTB-209` are complete.

## Task breakdown

1. Re-run privacy checks against the finished system.
2. Measure the single-label path and record timings.
3. Run final evals and record the results.
4. Write or update submission docs and README.
5. Prepare QA-style and final acceptance handoffs.
