# Task Breakdown

## Tasks

### Task 1

- Objective: lock the full golden case catalog, named slices, and stable case IDs.
- Dependency: `must-have`
- Validation: `jq . evals/golden/manifest.json && npm run evals:validate`

### Task 2

- Objective: document the rules for slice usage, live-subset asset naming, and result logging.
- Dependency: `must-have`
- Validation: manual review of `evals/README.md`, `evals/golden/README.md`, `evals/labels/README.md`, and `evals/results/README.md`

### Task 3

- Objective: wire the story queue and later implementation stories to consume applicable golden slices instead of ad hoc examples.
- Dependency: `must-have`
- Validation: manual review of `docs/specs/PROJECT_STORY_INDEX.md` and downstream story packets

### Task 4

- Objective: add a first baseline run log as soon as the single-label engine exists.
- Dependency: `blocked-by` `TTB-002`
- Validation: checked-in `evals/results/YYYY-MM-DD-TTB-002.md`
