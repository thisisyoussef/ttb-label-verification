# Task Breakdown

## Tasks

### Task 1

- Objective: lock the six baseline eval scenarios and their stable IDs.
- Dependency: `must-have`
- Validation: `jq . evals/labels/manifest.template.json`

### Task 2

- Objective: document the rules for corpus usage, asset naming, and result logging.
- Dependency: `must-have`
- Validation: manual review of `evals/README.md`, `evals/labels/README.md`, and `evals/results/README.md`

### Task 3

- Objective: wire the story queue and later implementation stories to consume the eval corpus instead of ad hoc examples.
- Dependency: `must-have`
- Validation: manual review of `docs/specs/PROJECT_STORY_INDEX.md` and downstream story packets

### Task 4

- Objective: add a first baseline run log as soon as the single-label engine exists.
- Dependency: `blocked-by` `TTB-002`
- Validation: checked-in `evals/results/YYYY-MM-DD-TTB-002.md`
