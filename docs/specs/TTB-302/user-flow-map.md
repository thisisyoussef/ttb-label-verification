# User Flow Map

## Primary flow

1. Reviewer switches to `Batch`.
2. Reviewer adds label images.
3. Reviewer adds CSV.
4. Reviewer reviews and resolves ambiguous or unmatched items.
5. Reviewer starts the live batch run.
6. Reviewer watches progress and item stream updates.
7. Reviewer opens the dashboard.
8. Reviewer opens a row in drill-in.
9. Reviewer returns to the dashboard.
10. Reviewer exports the batch result set.
11. Reviewer starts another batch or returns to intake.

## Required branches

### Intake and preflight

- images selected before CSV
- CSV selected before images
- malformed CSV
- over-cap image set
- ambiguous matches present
- unmatched images present
- unmatched rows present

### Run and stream

- happy path to terminal summary
- cancelled mid-run
- item-level error shown in stream
- retry available on error row
- stream start failure returns to intake with actionable copy

### Dashboard and drill-in

- dashboard summary load succeeds
- dashboard load fails
- drill-in report available
- drill-in report unavailable
- retry from dashboard succeeds
- retry from dashboard fails

### Export

- export confirm -> success
- export confirm -> failure
- export retry after failure

## Verification expectations

- Happy path and one non-happy path must be executed manually before handoff.
- Live runtime must not require any seed selector to complete the flow.
