# Constitution Check

## Story

- Story ID: `TTB-001`
- Title: single-label reviewer workflow and evidence surfaces

## Non-negotiable rules checked

- No persistence: satisfied; the UI must reinforce ephemeral review and must not imply durable storage of uploads or results.
- Responses API with `store: false`: satisfied; the UI story does not call the model directly and must preserve a backend contract that assumes `store: false`.
- Deterministic validators own compliance outcomes: satisfied; the UI presents model extraction and deterministic evidence, but does not own compliance logic.
- Shared contract impact reviewed: satisfied; this story defines the UI surfaces that the expanded shared review contract must support.
- Latency or UX constraints reviewed: satisfied; the primary single-label flow must stay understandable in two clicks or less and feel consistent with the sub-5-second target.

## Exceptions

- None.
