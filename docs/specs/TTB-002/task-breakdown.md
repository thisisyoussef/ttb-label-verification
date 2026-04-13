# Task Breakdown

## Tasks

### Task 1

- Objective: expand the shared review contract to cover the approved single-label evidence surfaces.
- Dependency: `must-have`
- Validation: RED contract tests in `src/shared/contracts`

### Task 2

- Objective: implement upload intake, request normalization, and no-persistence-safe request handling.
- Dependency: `must-have`
- Validation: endpoint tests plus `privacy-checklist.md`

### Task 3

- Objective: implement extraction, beverage inference, and image-quality assessment using the Responses API with structured outputs.
- Dependency: `must-have`
- Validation: eval slice against relevant cases and route-level tests

### Task 4

- Objective: implement deterministic validators for warning, format, fuzzy comparison, beverage-specific rules, and cross-field dependencies.
- Dependency: `must-have`
- Validation: RED -> GREEN validator tests plus `rule-source-map.md`

### Task 5

- Objective: implement recommendation aggregation and response shaping for the approved UI surfaces.
- Dependency: `must-have`
- Validation: end-to-end review route returns the contract defined in `evidence-contract.md`

### Task 6

- Objective: run the full six-label eval slice, capture measured timings, and close privacy/performance gaps.
- Dependency: `blocked-by` Tasks 1-5
- Validation: `evals/results/YYYY-MM-DD-TTB-002.md`, `performance-budget.md`, `privacy-checklist.md`
