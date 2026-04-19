# Task Breakdown

## Task 1

- Objective: define the shared prompt-policy contract and endpoint overlays for the current model-backed routes
- Dependency: `must-have`
- Validation: prompt-policy tests prove the repo can resolve `review`, `extraction`, and `warning` overlays deterministically while batch item surfaces map to the canonical `review` overlay

## Task 2

- Objective: add structural extraction guardrails that normalize sparse, hallucinated, or inconsistent outputs before routes treat them as successful extraction
- Dependency: `must-have`
- Validation: unit tests cover sparse-output, warning-block, and suspicious-certainty cases

## Task 3

- Objective: route every current model-backed surface through the shared prompt-policy and guardrail path
- Dependency: `must-have`
- Validation: route and batch tests prove all current LLM endpoints use the centralized path

## Task 4

- Objective: run trace-driven tuning on the smallest approved fixture slice and record the winning prompt-profile decisions
- Dependency: `must-have`
- Validation: `trace-brief.md` and `evals/results/` record the winning traces or explicit blockers

## Task 5

- Objective: verify privacy and latency after prompt hardening
- Dependency: `must-have`
- Validation: `privacy-checklist.md` and `performance-budget.md` are completed with measured evidence
