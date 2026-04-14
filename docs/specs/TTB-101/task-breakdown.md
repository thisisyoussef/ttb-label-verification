# Task Breakdown

## Task 1

- Objective: expand the compact packet into the required Codex engineering artifacts
- Dependency: `must-have`
- Validation: `docs/specs/TTB-101/` contains the core packet plus privacy and performance docs

## Task 2

- Objective: formalize the approved intake payload, step IDs, and structured error shape in shared contracts
- Dependency: `must-have`
- Validation: contract tests cover the new schemas and existing report contract remains valid

## Task 3

- Objective: add a route-local multipart `POST /api/review` stub that validates upload inputs and returns the seed report
- Dependency: `must-have`
- Validation: server tests cover happy path and structured validation failures

## Task 4

- Objective: verify no-persistence handling and record a local latency sample for the single-label path
- Dependency: `must-have`
- Validation: privacy checklist and performance budget are updated with measured evidence

## Task 5

- Objective: sync tracker, backlog handoff, and memory docs with the Codex pass outcome
- Dependency: `parallel`
- Validation: story state, residual blockers, and durable notes are updated in checked-in docs
