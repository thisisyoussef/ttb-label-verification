# Task Breakdown

## Task 1

- Objective: define the endpoint matrix for the current model-backed route graph
- Dependency: `must-have`
- Validation: packet and eval docs explicitly enumerate `/api/review`, `/api/review/extraction`, `/api/review/warning`, and the batch model path

## Task 2

- Objective: add persona scorecards tied to concrete user-facing promises instead of generic accuracy only
- Dependency: `must-have`
- Validation: scorecards for Sarah, Dave, Jenny, Marcus, and Janet are checked in and reference concrete slices or heuristics

## Task 3

- Objective: extend the eval manifest/docs/template with endpoint-aware metadata and run-log sections
- Dependency: `must-have`
- Validation: `evals/README.md`, `evals/golden/manifest.json` as needed, and `evals/results/TEMPLATE.md` agree on the new shape

## Task 4

- Objective: extend trace-driven-development guidance so winning traces always record endpoint and prompt-profile context
- Dependency: `must-have`
- Validation: `docs/process/TRACE_DRIVEN_DEVELOPMENT.md` and the packet agree on the required trace metadata

## Task 5

- Objective: wire the endpoint-aware evidence into the release gate
- Dependency: `must-have`
- Validation: `TTB-401` references the new endpoint-aware eval evidence explicitly
