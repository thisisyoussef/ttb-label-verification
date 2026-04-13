# TDD Pipeline Workflow

## Purpose

Enforce RED -> GREEN -> REFACTOR for every behavior change.

## Step 1: Start from the spec

Use the active acceptance criteria and task breakdown as the implementation contract. Pull in `evidence-contract.md`, `rule-source-map.md`, `privacy-checklist.md`, `performance-budget.md`, and `eval-brief.md` when the story includes them.

## Step 2: Write the RED tests first

- Add or update tests before implementation.
- Cover happy path, failure path, and explicit edge cases from the spec.
- Add negative tests for no-persistence and uncertainty-to-`review` behavior when the story touches uploads, model calls, or visual confidence handling.
- Add latency measurement or assertion hooks when the story touches the single-label critical path.
- If tests are already green before implementation, stop and strengthen them or narrow the story.

## Step 3: GREEN with the smallest change

- Implement the minimum code that makes the RED tests pass.
- Do not widen scope while chasing green.

## Step 4: REFACTOR separately

- Clean structure only after green is established.
- Keep behavior constant while refactoring.

## Step 5: Verify

Run:

- `npm run test`
- `npm run typecheck`
- `npm run build`

Add targeted checks when the story defines them:

- eval run recorded in `evals/results/` for AI or validator stories
- privacy checklist verified for upload/model stories
- measured timing captured for latency-sensitive stories

## Step 6: Sync docs

Update the active spec packet, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, and memory files when the story changes durable truth.

## Exit criteria

- Acceptance criteria have corresponding tests
- RED occurred before implementation
- GREEN is validated
- Refactor happened as a separate step
- Docs, rule sources, eval result, and memory are synced
