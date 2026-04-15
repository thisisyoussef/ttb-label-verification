# Task Breakdown

- [x] Create the `TTB-302` packet, tracker entries, and flow docs.
- [x] Add RED tests that prove normal runtime uses the live batch path by default.
- [x] Refactor client batch state so live batch is the primary workflow and fixtures are explicitly gated.
- [x] Tighten dashboard, drill-in, retry, and export behavior in live mode.
- [x] Add or update route and contract tests for the hardened batch flow.
- [x] Review help dependencies and confirm no batch help-anchor or manifest change was required for this state-flow-only cut.
- [x] Run `npm run test`, `npm run typecheck`, and `npm run build`.
- [x] Start the app, execute a live batch happy path in the browser, and record the manual script in the handoff.

## Manual verification summary

Date: 2026-04-15

1. Opened `http://localhost:5178/`.
2. Signed in through mock auth and switched the workstation to `Batch`.
3. Confirmed batch intake opened with no seeded rows or stream items:
   - `Images 0`
   - `CSV rows 0`
   - `Matched 0`
4. Switched to cloud mode and uploaded:
   - `evals/labels/assets/perfect-spirit-label.png`
   - `evals/labels/assets/spirit-warning-errors.png`
   - temp CSV `/tmp/ttb-302-batch.hh9RC3.csv`
5. Confirmed live preflight matched `2` images to `2` rows and rendered submitted CSV identities:
   - `Manual Batch Alpha`
   - `Manual Batch Beta`
6. Started the live batch run and observed:
   - processing progress `Processed 1 of 2`
   - terminal summary `0 Pass · 1 Review · 1 Fail`
7. Opened the live dashboard and confirmed row labels still reflected the submitted CSV values instead of fixture content.
