# Story Packet

## Metadata

- Story ID: `TTB-101`
- Title: single-label intake and processing UI
- Parent: `TTB-001`
- Primary lane: Claude
- Packet mode: compact planning packet

## Constitution check

- UI only. No `src/server/**` or `src/shared/**` edits.
- Must prepare and use `stitch-screen-brief.md`.
- Must seed states from the six-label eval scenarios where relevant.
- Must stop for visual review and then produce a Codex handoff only if backend work becomes required.

## Feature spec

### Problem

The product needs a clear first-run screen and a believable processing state before the reviewer can trust the rest of the flow.

### Acceptance criteria

- Intake includes upload, optional application data, beverage-specific conditional fields, and a clear primary action.
- Missing image, invalid file type, and oversized file states are explicit.
- Processing view shows image confirmation and multi-step progress.
- The design is large-text friendly, keyboard reachable, and consistent with the workstation visual baseline.

## Technical plan

- Likely implementation surfaces: `src/client/main.tsx` and future intake/process components under `src/client/**`.
- Requires `ui-component-spec.md` and `stitch-screen-brief.md` before implementation.
- Backend needs should be written into the later Codex handoff, not into shared contracts.

## Task breakdown

1. Update or expand the UI design spec for intake and processing.
2. Write the Stitch brief and stop for the user to return image plus HTML/code references.
3. Implement the approved intake and processing screens with mock or no data.
4. Start the dev server and stop for visual review.
5. Record any backend data needs in the later Codex handoff if they surface.
