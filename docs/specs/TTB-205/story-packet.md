# Story Packet

## Metadata

- Story ID: `TTB-205`
- Title: field comparison, beverage rules, cross-field checks, and recommendation aggregation
- Parent: `TTB-002`
- Primary lane: Codex
- Packet mode: compact planning packet

## Constitution check

- Engineering-only story.
- Must preserve cosmetic-difference handling as `review`, not `fail`.
- Recommendation logic must be deterministic and evidence-backed.
- No frontend redesign allowed.

## Feature spec

### Problem

After extraction and warning validation exist, the product still needs the full comparison and recommendation layer to become a usable reviewer tool.

### Acceptance criteria

- Fuzzy cosmetic brand differences land in `review`.
- Beverage-specific mandatory and cross-field checks work for the proof-of-concept rule set.
- Recommendation aggregation matches the approved UI semantics.
- Single-label route returns the full integrated result model within the parent performance budget.

## Technical plan

- Implement comparison utilities, rule modules, and recommendation aggregation under `src/server/**`.
- Expand the parent evidence, rule-source, privacy, performance, and eval docs when active.
- Reuse shared contract types from `TTB-201`.

## Task breakdown

1. Write failing rule and recommendation tests.
2. Implement field comparison and fuzzy-match handling.
3. Add beverage-specific and cross-field validators.
4. Shape the final single-label response payload.
5. Run the six-label eval and record latency findings.
