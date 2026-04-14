# Technical Plan

## Scope

Expand `TTB-101` from a compact UI packet into a full engineering packet, then add the smallest backend/shared contract surface that honors the approved handoff without pulling live extraction or validator work forward.

## Modules and files

- Add `docs/specs/TTB-101/constitution-check.md`
- Add `docs/specs/TTB-101/feature-spec.md`
- Add `docs/specs/TTB-101/technical-plan.md`
- Add `docs/specs/TTB-101/task-breakdown.md`
- Add `docs/specs/TTB-101/privacy-checklist.md`
- Add `docs/specs/TTB-101/performance-budget.md`
- Update `src/shared/contracts/review.ts`
- Update `src/shared/contracts/review.test.ts`
- Update `src/server/index.ts`
- Update `src/server/index.test.ts`
- Update `package.json` and lockfile only if multipart parsing needs a new dependency

## Contracts

- Keep `VerificationReport` unchanged for this story; the route returns the existing seed report
- Add shared schema for the approved intake `fields` payload
- Add shared schema for processing step IDs and structured review errors
- Treat multipart transport details as server-boundary concerns, not a browser-shared type

## Implementation notes

- Use route-local multipart handling only on `POST /api/review`
- Keep file handling in memory and enforce explicit limits
- Parse and validate the `fields` part with Zod after JSON decoding
- Return plain-English structured errors for validation and upload failures
- Leave `/api/review/seed` in place for now so existing scaffold/debug paths remain stable

## Risks and fallback

- Risk: swallowing `TTB-202` by implementing too much upload logic here
  - Fallback: stop at validation and seed-response wiring; defer normalization and extractor integration
- Risk: the frozen UI cannot consume the new route without `src/client/**` changes
  - Fallback: document the required hookup explicitly in the backlog handoff and keep the backend route ready
- Risk: in-memory multipart parsing can increase memory pressure
  - Fallback: enforce strict file, part, and field limits and keep the route-local scope narrow

## Testing strategy

- RED tests first for success, unsupported MIME, oversized file, malformed JSON, and missing file cases
- Contract tests for the new intake/error schemas
- Final verification with `npm run test`, `npm run typecheck`, and `npm run build`
- Local timing capture for the stub review route
