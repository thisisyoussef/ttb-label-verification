# Task Breakdown

## Tasks

### Task 1

- Objective: audit and fix accessibility, readability, and trust-copy issues across the integrated UI.
- Dependency: `must-have`
- Validation: manual accessibility pass and visual review

### Task 2

- Objective: create the Stitch brief for the final polish pass and record any returned references used to tune the release UI.
- Dependency: `blocked-by` Task 1
- Validation: `docs/specs/TTB-004/stitch-screen-brief.md`

### Task 3

- Objective: harden error handling so every user-facing failure is clear, calm, and actionable.
- Dependency: `blocked-by` Task 2
- Validation: explicit walkthrough of upload, processing, timeout, low-confidence, and batch-failure states

### Task 4

- Objective: verify the final no-persistence and `store: false` guarantees against the finished system.
- Dependency: `blocked-by` Task 3
- Validation: `privacy-checklist.md`

### Task 5

- Objective: measure the finished single-label critical path and record the final timing evidence.
- Dependency: `blocked-by` Task 4
- Validation: `performance-budget.md` plus final eval run

### Task 6

- Objective: produce the submission documentation and final smoke-test artifacts.
- Dependency: `blocked-by` Tasks 1-5
- Validation: updated `README.md` and final `evals/results/` entries
