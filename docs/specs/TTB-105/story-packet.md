# Story Packet

## Metadata

- Story ID: `TTB-105`
- Title: accessibility, trust copy, and final UI polish
- Parent: `TTB-004`
- Primary lane: Claude
- Packet mode: compact planning packet

## Constitution check

- UI-only polish story.
- Must preserve approved screen hierarchy rather than redesigning the product.
- Must focus on readability, keyboard reachability, trust tone, and dense-state clarity.

## Feature spec

### Problem

The integrated product will fail reviewer trust if dense states, warnings, and errors feel brittle or hard to read late in the process.

### Acceptance criteria

- Status, error, and low-confidence messaging remain clear without relying on color alone.
- Dense warning detail, batch empty states, and filter states are readable at practical zoom.
- Copy remains calm, procedural, and non-promotional.
- Final UI pass is explicitly approved before Codex runs the release gate.

## Technical plan

- Work from the integrated screens produced by the earlier UI stories.
- Use a final Stitch brief only if a visual polish reference is needed.
- Feed any remaining backend message or state requirements into the release-gate packet.

## Task breakdown

1. Audit the integrated UI for accessibility and trust gaps.
2. If needed, create a final polish Stitch brief and implement against the approved direction.
3. Fix copy, density, empty states, and error presentation in `src/client/**`.
4. Stop for final UI approval.
5. Hand the polished contract to Codex for the release gate.
