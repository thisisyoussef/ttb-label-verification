# Story Packet

## Metadata

- Story ID: `TTB-102`
- Title: single-label results, warning evidence, and standalone UI
- Parent: `TTB-001`
- Primary lane: Claude
- Packet mode: compact planning packet

## Constitution check

- UI only. Do not implement validators or contract changes here.
- Must preserve checklist-first results hierarchy.
- Must include the warning detail surface and standalone-mode treatment.
- Must stop for visual review and then hand off approved constraints to Codex.

## Feature spec

### Problem

The proof of concept only becomes persuasive when the result view communicates recommendation, evidence, and uncertainty in one pass.

### Acceptance criteria

- Results show recommendation banner, counts, checklist rows, expandable details, and cross-field section.
- Warning detail includes sub-check structure, diff zone, citation area, and confidence context.
- Standalone mode is clearly distinct from comparison mode.
- Low-confidence, no-text, and recoverable error states are visually coherent.

## Technical plan

- Build on the visual language established in `TTB-101`.
- Expand `ui-component-spec.md` with result rows, warning detail, standalone mode, and reset flow.
- Produce a Codex handoff after approval with frozen result structure, copy, and interaction rules.

## Task breakdown

1. Expand the story into working UI docs if needed.
2. Update the results-focused UI design spec and Stitch brief.
3. Stop for Stitch output and then implement the approved result screens.
4. Run the app, prepare seeded review states, and stop for visual review.
5. Write the `ready-for-codex` handoff with required backend fields and evidence behavior.
