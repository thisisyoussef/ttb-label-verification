# Constitution Check

## Story

- Story ID: `TTB-208`
- Title: latency observability and sub-4-second budget framing
- Parent: `TTB-002`
- Primary lane: Codex
- Packet mode: standard

## Non-negotiables

- No uploaded label image, application data, or verification result may be persisted.
- Timing instrumentation may record only bounded technical metadata such as stage name, provider, outcome class, and duration; it may not capture raw label text, base64 payloads, filenames, prompt bodies, or application field values.
- OpenAI paths must keep `store: false`.
- Gemini paths must remain inline-only with logging/data-sharing disabled; no Files API or explicit cache TTL surfaces are allowed.
- The approved UI remains fixed input. This story adds measurement and budgeting, not a visible redesign.
- This story defines how the repo will measure and enforce a tighter latency goal, but it does not yet claim the product has achieved `<= 4,000 ms`.

## Required companion artifacts

- `feature-spec.md`
- `technical-plan.md`
- `task-breakdown.md`
- `privacy-checklist.md`
- `performance-budget.md`
- `eval-brief.md`

## Blocking notes

- `TTB-207` must land first so stage timing is added to the real Gemini-primary extraction path instead of a temporary pre-cutover seam.
