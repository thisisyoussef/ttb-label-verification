# Task Breakdown

## Tasks

### Task 1

- Objective: author the full single-label UI design in `ui-component-spec.md`, aligned to the master design baseline and the six eval scenarios.
- Dependency: `must-have`
- Validation: manual review of `docs/specs/TTB-001/ui-component-spec.md`

### Task 2

- Objective: create the Stitch brief, stop for the user to run Stitch, and record the returned references in `stitch-screen-brief.md`.
- Dependency: `blocked-by` Task 1
- Validation: `docs/specs/TTB-001/stitch-screen-brief.md`

### Task 3

- Objective: build the seeded intake, processing, results, standalone, and error-state flow in `src/client/**`.
- Dependency: `blocked-by` Task 2
- Validation: local runnable UI with seeded scenarios and explicit visual-review handoff

### Task 4

- Objective: stop for visual review and capture any design corrections before engineering integration.
- Dependency: `blocked-by` Task 3
- Validation: `.ai/workflows/story-handoff.md` visual-review handoff

### Task 5

- Objective: create the Codex handoff doc with frozen layout/copy/interaction rules and the required backend data/evidence contract.
- Dependency: `blocked-by` Task 4
- Validation: `docs/backlog/codex-handoffs/TTB-001.md`
