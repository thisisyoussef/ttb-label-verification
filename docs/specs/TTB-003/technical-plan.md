# Technical Plan

## Scope

Add the full batch path on top of the single-label engine and UI patterns.

## Modules and files

- `docs/specs/TTB-003/ui-component-spec.md` — batch upload, progress, and dashboard design.
- `docs/specs/TTB-003/evidence-contract.md` — batch summary and drill-in payload contract.
- `docs/specs/TTB-003/privacy-checklist.md` — batch-specific ephemeral handling checks.
- `src/client/**` planned surfaces:
  - batch upload
  - batch progress
  - batch dashboard
  - single-item drill-in reuse
- `src/server/**` planned logical modules:
  - CSV parsing and normalization
  - file/row matching
  - bounded-concurrency batch runner
  - batch summary aggregation
  - export generation

## Contracts

- Batch request:
  - multiple label files
  - one CSV file
  - optional matching overrides
- Batch response:
  - batch ID scoped to the current session only
  - progress counts
  - result rows with recommendation, severity, issue count, and status
  - drill-in reference or embedded single-label result model
  - export payload or export trigger response

## Risks and fallback

- Risk: batch processing causes memory or responsiveness problems.
  - Fallback: use bounded concurrency and incremental result streaming or polling.
- Risk: matching logic becomes opaque to reviewers.
  - Fallback: show explicit match state and a manual correction path.
- Risk: batch results diverge from single-label semantics.
  - Fallback: require drill-in to reuse the same evidence model and recommendation language as `TTB-002`.

## Testing strategy

- unit:
  - CSV header mapping
  - file/row matching logic
  - summary aggregation
- integration:
  - end-to-end batch upload and result generation
  - export generation
- contract:
  - batch summary payload
  - drill-in reuse of single-label result contract
- UI behavior:
  - upload, progress, filter, sort, drill-in, and empty/error states
