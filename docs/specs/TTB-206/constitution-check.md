# Constitution Check

## Story

- Story ID: `TTB-206`
- Title: extraction mode routing foundation and privacy-safe cloud/local provider policy
- Lane: Codex-only

## Non-negotiables

- No uploaded label image, application field, batch row, or verification result may be persisted.
- OpenAI legs remain on the Responses API with `store: false`.
- Gemini legs must not use the Files API, AI Studio log sharing, datasets, or any other durable provider-side upload surface.
- The approved UI and `VerificationReport` contract stay fixed in this foundation story.
- This story establishes routing and policy only. The live label-extraction default does not flip to Gemini until `TTB-207` clears eval, trace, privacy, and performance gates.

## Required packet artifacts

- `privacy-checklist.md`
- `eval-brief.md`

## Lane-specific scope

- In scope: server routing, provider config, env/bootstrap wiring, packet/docs updates, and test seams.
- Out of scope: UI changes, new reviewer-facing evidence fields, and the Gemini-primary extraction cutover itself.
