# Task Breakdown

## Tasks

### Task 1

- Objective: design the batch upload, progress, and dashboard surfaces and stop for visual review.
- Dependency: `must-have`
- Validation: `docs/specs/TTB-003/ui-component-spec.md` plus visual-review handoff

### Task 2

- Objective: create the Stitch brief, stop for the user to run Stitch, and record the returned references in `stitch-screen-brief.md`.
- Dependency: `blocked-by` Task 1
- Validation: `docs/specs/TTB-003/stitch-screen-brief.md`

### Task 3

- Objective: implement CSV parsing, file matching, and batch request normalization.
- Dependency: `blocked-by` Task 2
- Validation: parser and matcher tests

### Task 4

- Objective: implement bounded-concurrency batch processing on top of the single-label engine.
- Dependency: `blocked-by` Task 3
- Validation: integration tests with mixed success/failure cases

### Task 5

- Objective: implement the batch dashboard contract, drill-in behavior, and export flow.
- Dependency: `blocked-by` Task 4
- Validation: contract tests plus UI drill-in behavior review

### Task 6

- Objective: verify batch privacy constraints and close any ambiguity around session-scoped reviewed/confirmed markers.
- Dependency: `blocked-by` Tasks 3-5
- Validation: `privacy-checklist.md`
