# Story Packet

## Metadata

- Story ID: `TTB-204`
- Title: government warning validator and diff evidence
- Parent: `TTB-002`
- Primary lane: Codex
- Packet mode: compact planning packet

## Constitution check

- Engineering-only story.
- Must keep warning logic deterministic where evidence is clear.
- Must degrade ambiguous boldness, continuity, or separation judgments to `review`.
- Must update rule-source and evidence docs when active implementation begins.

## Feature spec

### Problem

The government warning is the showcase validator and the most important rejection-critical surface in the product.

### Acceptance criteria

- Exact-text comparison works against the canonical warning text.
- Sub-check structure covers caps, bold prefix, non-bold body, punctuation, continuity, and separation.
- Diff evidence is precise enough to power the warning UI.
- The warning-error eval case is caught reliably.

## Technical plan

- Implement warning normalization, comparison, and evidence shaping in isolated modules.
- Prepare to expand parent `evidence-contract.md` and `rule-source-map.md` when the story activates.
- Keep warning logic separate from extraction transport.

## Task breakdown

1. Add failing warning comparison tests.
2. Implement canonical warning validation and diff shaping.
3. Encode uncertainty behavior for the non-text visual sub-checks.
4. Verify the warning defect eval case.
5. Update the parent rule and evidence docs with final semantics.
