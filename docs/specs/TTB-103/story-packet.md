# Story Packet

## Metadata

- Story ID: `TTB-103`
- Title: batch intake, matching review, and progress UI
- Parent: `TTB-003`
- Primary lane: Claude
- Packet mode: compact planning packet

## Constitution check

- UI only.
- Must reuse the single-label visual language instead of inventing a new dashboard brand.
- Must stop for Stitch, then visual review, before any Codex batch engineering work starts.

## Feature spec

### Problem

High-volume reviewers need a batch entry flow that explains matching and progress clearly enough to trust before the backend is live.

### Acceptance criteria

- Batch upload supports many label files and one CSV.
- Matching review explains filename-first and order-based matching.
- Progress view feels believable and readable without tiny charts.
- Error states cover malformed CSV, ambiguous matches, and partial failure framing.

## Technical plan

- Add or expand batch-specific `ui-component-spec.md` content when this story activates.
- Create a Stitch brief focused on batch intake and progress.
- Preserve drill-in as a future link into the single-label result model rather than inventing a new evidence system.

## Task breakdown

1. Write the batch intake and progress design spec.
2. Prepare the Stitch brief and block for user-returned references.
3. Implement batch intake, match review, and progress UI with mock states.
4. Stop for visual review.
5. Record the required backend matching and progress behavior for Codex.
