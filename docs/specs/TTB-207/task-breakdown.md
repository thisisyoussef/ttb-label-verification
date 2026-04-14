# Task Breakdown

## Task 1

- Objective: add the Gemini extraction adapter with inline image/PDF request building and structured-output normalization
- Dependency: `must-have`
- Validation: adapter tests cover image input, PDF input, schema parse success, and retriable failure classification

## Task 2

- Objective: wire Gemini-primary extraction into the provider factory and route boot path
- Dependency: `must-have`
- Validation: route tests prove Gemini-primary selection and OpenAI fallback selection with injected fakes

## Task 3

- Objective: propagate the same label-extraction provider order into batch execution
- Dependency: `must-have`
- Validation: batch tests prove item extraction uses the shared router instead of a hard-coded provider

## Task 4

- Objective: run trace-driven tuning on the smallest approved fixture slice and record the winning Gemini model/prompt/schema combination
- Dependency: `must-have`
- Validation: `trace-brief.md` and `evals/results/` record the winning traces or the explicit blocker

## Task 5

- Objective: verify privacy and timing before declaring Gemini the default
- Dependency: `must-have`
- Validation: `privacy-checklist.md` and `performance-budget.md` are completed with measured evidence
