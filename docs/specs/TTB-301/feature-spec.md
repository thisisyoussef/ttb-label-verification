# Feature Spec

## Story

`TTB-301` batch parser, matcher, orchestration, and session export

## Outcome

The approved batch shells from `TTB-103` and `TTB-104` now run against a real session-scoped batch engine. Reviewers can upload many label images plus one CSV, resolve matching, stream the run, open the dashboard, drill into existing single-label reports, export the session JSON, and retry errored rows without persisting files or results.

## Behavior

- Preflight parses the CSV, validates files, and returns typed matching groups.
- Run streams progress and item outcomes using the existing single-label deterministic report builder.
- Dashboard rows preserve submitted CSV identity values (`brandName`, `classType`) while drill-in reuses the single-label `VerificationReport`.
- Export returns one JSON payload for the live session only.
