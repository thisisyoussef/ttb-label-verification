# Task Breakdown

## Tasks

### Task 1

- Objective: expand the compact packet into the standard working artifact set for this story.
- Dependency: `must-have`
- Validation: packet files checked in under `docs/specs/TTB-203/`

### Task 2

- Objective: define the shared extraction contract and RED tests for field, beverage, and image-quality semantics.
- Dependency: `must-have`
- Validation: failing contract and helper tests before implementation

### Task 3

- Objective: implement the OpenAI Responses adapter and runtime config handling with no-persistence guarantees.
- Dependency: `must-have`
- Validation: adapter unit tests and route-level extraction tests

### Task 4

- Objective: expose the extraction path for later validator stories without redesigning the approved UI flow.
- Dependency: `must-have`
- Validation: extraction route returns the typed contract; seeded review route stays intact for now

### Task 5

- Objective: run the story verification set and record privacy, performance, and eval status.
- Dependency: `blocked-by` Tasks 1-4
- Validation: updated packet artifacts, `evals/results/2026-04-13-TTB-203.md`, and tracker/memory refresh
