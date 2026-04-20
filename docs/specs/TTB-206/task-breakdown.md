# Task Breakdown

## Task 1

- Objective: add the provider-policy module and typed capability ordering
- Dependency: `must-have`
- Validation: unit tests cover provider parsing, default ordering, and invalid config handling

## Task 2

- Objective: wrap the current OpenAI extractor behind the provider interface and factory
- Dependency: `must-have`
- Validation: route tests prove the app still boots and serves the current contract through the factory path

## Task 3

- Objective: extend local env/bootstrap docs for Gemini keys and provider-order settings
- Dependency: `must-have`
- Validation: `scripts/bootstrap/bootstrap-local-env.ts`, `FULL_PRODUCT_SPEC.md`, and packet docs agree on the new config names

## Task 4

- Objective: lock the Gemini privacy rules into packet/docs before any live Gemini call exists
- Dependency: `must-have`
- Validation: `privacy-checklist.md` names the no-Files/no-logging guardrails and cites the official sources

## Task 5

- Objective: leave the live extraction default unchanged and hand off the actual cutover to `TTB-207`
- Dependency: `must-have`
- Validation: SSOT and the story index mark `TTB-207` as the dependent cutover story
