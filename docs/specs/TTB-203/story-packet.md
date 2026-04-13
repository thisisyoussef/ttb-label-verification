# Story Packet

## Metadata

- Story ID: `TTB-203`
- Title: extraction adapter, beverage inference, and image-quality assessment
- Parent: `TTB-002`
- Primary lane: Codex
- Packet mode: compact planning packet

## Constitution check

- Engineering-only story.
- Must use the Responses API with `store: false`.
- The first model pass is extraction only, not holistic compliance judgment.
- Ambiguous outputs must remain reversible.

## Feature spec

### Problem

The product needs a typed, structured extraction layer before deterministic validation can work.

### Acceptance criteria

- Live extraction returns typed fields, confidences, beverage hints, and image-quality signals.
- Beverage type uses application input when present, otherwise inferred with a documented fallback.
- Extraction uncertainty is explicit enough to drive `review` later.
- Story output is eval-ready against the six-label corpus.

## Technical plan

- Add an OpenAI adapter module under `src/server/**`.
- Use structured outputs and a stable schema.
- Extend the parent eval brief with extraction-specific failure modes.

## Task breakdown

1. Write failing tests around extraction contract boundaries where practical.
2. Implement the Responses adapter and extraction schema.
3. Add beverage inference and image-quality logic.
4. Run the relevant eval slice and record findings.
5. Carry open uncertainty limits into the next validator stories.
