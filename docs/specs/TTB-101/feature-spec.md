# Feature Spec

## Story

- Story ID: `TTB-101`
- Title: single-label intake and processing UI

## Problem statement

Claude finished and froze the intake and processing UI, but the engineering packet is still compact and the backend contract behind that UI is mostly implied. Codex needs to turn the approved handoff into explicit engineering artifacts and provide the minimum server/shared surface that lets later stories connect the frozen intake flow to a real review route without redesigning the frontend.

## User-facing outcomes

- The approved intake and processing UI has a checked-in engineering packet behind it.
- The backend exposes a real review route shape instead of only a seed GET endpoint.
- Upload validation failures return plain-English structured errors the frozen UI can map directly.
- The no-persistence and sub-5-second posture for the single-label path is explicit and measured.

## Acceptance criteria

1. `docs/specs/TTB-101/` contains the required engineering packet for a standard Codex story.
2. Shared contracts define the intake field payload, processing step IDs, and structured review error shape needed by the approved UI handoff.
3. The server exposes `POST /api/review` as a route-local multipart endpoint that:
   - accepts one `label` file
   - accepts a `fields` JSON part
   - rejects unsupported MIME types and oversized files before any downstream work
   - returns the existing seed verification report on success
4. Error responses are plain-English, structured, and do not require the client to infer meaning from HTTP status codes.
5. The implementation keeps uploads in memory only, avoids sensitive logging, and records local timing against the story budget.

## Edge cases

- missing `label` part
- malformed `fields` JSON
- `fields` payload that does not match the approved intake shape
- unsupported upload MIME type
- file larger than 10 MB
- multipart requests that attempt extra file parts

## Out of scope

- changing layout, copy, interaction flow, or any `src/client/**` file
- live OpenAI extraction or Responses API wiring
- deterministic rule evaluation beyond returning the existing seed report
- SSE or other streamed progress transport
- results-frame implementation (`TTB-102`)
