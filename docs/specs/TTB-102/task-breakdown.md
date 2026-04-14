# Task Breakdown

## Task 1

- Objective: materialize the missing Codex engineering packet for `TTB-102`
- Dependency: `must-have`
- Validation: `docs/specs/TTB-102/` contains constitution, feature, technical-plan, task-breakdown, privacy, and performance docs

## Task 2

- Objective: make the client render the `/api/review` payload instead of discarding it
- Dependency: `must-have`
- Validation: client helper tests prove live payloads beat fixture fallbacks unless fixture mode is intentionally enabled

## Task 3

- Objective: teach the seed review route to emit a true standalone report
- Dependency: `must-have`
- Validation: shared-contract and route tests prove omitted fields yield `standalone: true`, `not-applicable` comparisons, and `info` cross-field skips

## Task 4

- Objective: gate fixture controls so approved UI surfaces are not permanently tied to seeded debug selectors
- Dependency: `must-have`
- Validation: fixture-control helper tests pass and `src/client/App.tsx` only renders those selectors when fixture mode is enabled

## Task 5

- Objective: sync tracker, handoffs, workflow docs, and memory with the `TTB-10x` priority rule and the completed integration work
- Dependency: `parallel`
- Validation: SSOT, AGENTS, workflows, and handoff docs all agree on `TTB-102` / `TTB-103` completion and future `TTB-10x` selection priority
