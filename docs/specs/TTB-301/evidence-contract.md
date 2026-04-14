# Evidence Contract

## Reused evidence model

- Batch drill-in returns the same `VerificationReport` shape already approved for `TTB-102` and implemented in `TTB-205`.
- No new per-check rule families were introduced for batch mode.

## New batch payloads

- Preflight: CSV headers, CSV preview rows, matching groups, file errors, and ephemeral `batchSessionId`
- Stream: progress frames, item outcome frames, terminal summary frame
- Dashboard: row-level batch status, submitted identity values, issue counts grouped by severity, and nullable `reportId`
- Export: dashboard rows plus a `reports` map keyed by `reportId`
