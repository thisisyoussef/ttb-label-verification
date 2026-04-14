# TDD Pipeline Workflow

## Purpose

Enforce RED -> GREEN -> REFACTOR for every behavior change, and keep the resulting suite hard to fool.

## Step 1: Start from the spec

Use the active acceptance criteria and task breakdown as the implementation contract. Pull in `docs/process/TEST_QUALITY_STANDARD.md`, `evidence-contract.md`, `rule-source-map.md`, `privacy-checklist.md`, `performance-budget.md`, and `eval-brief.md` when the story includes them.

Before writing tests, decide:

- the lowest viable layer for each acceptance criterion
- which boundaries need contract tests
- which pure helpers need property tests
- which high-risk pure modules deserve a targeted mutation pass
- which flake hazards need seams for time, randomness, filesystem, or env

## Step 2: Write the RED tests first

- Add or update tests before implementation.
- Cover happy path, failure path, boundary values, and explicit edge cases from the spec.
- When the change crosses a route, adapter, or seed/staging bridge into approved UI, include a RED test with non-default user input that proves the value survives into the returned contract or rendered result. Schema-shape assertions alone do not satisfy this.
- Add negative tests for no-persistence and uncertainty-to-`review` behavior when the story touches uploads, model calls, or visual confidence handling.
- Prefer one Act step per test. Use parameterized tests when several inputs prove the same rule.
- Test public behavior and observable outputs, not private helper structure or internal call choreography.
- Keep unit tests hermetic: no real network, no uncontrolled clock, no hidden shared state.
- For broad input spaces such as comparison, normalization, parsing, or tolerance logic, add property tests instead of relying only on a few hand-picked examples.
- Add latency measurement or assertion hooks when the story touches the single-label critical path.
- If tests are already green before implementation, stop and strengthen them or narrow the story.

## Step 3: GREEN with the smallest change

- Implement the minimum code that makes the RED tests pass.
- Do not widen scope while chasing green.

## Step 4: REFACTOR separately

- Clean structure only after green is established.
- Keep behavior constant while refactoring.
- Refactor tests too when they are noisy, duplicated, or too coupled to internals.

## Step 5: Harden the suite

- Add contract tests when a boundary or payload shape changed.
- Add property tests when invariants matter more than a handful of examples.
- For critical pure logic such as validators, comparison helpers, severity mapping, or normalization, run a targeted mutation pass when the story risk justifies it:

```bash
npm run test:mutation -- --mutate "src/server/government-warning-validator.ts"
```

- If a targeted mutation run is skipped for a high-risk pure module, record why.
- If a test needs retries, sleeps, or machine-specific ordering to pass, treat that as a defect and fix the seam.

## Step 6: Verify

Run:

- `npm run test`
- `npm run typecheck`
- `npm run build`

Add targeted checks when the story defines them:

- eval run recorded in `evals/results/` for AI or validator stories
- privacy checklist verified for upload/model stories
- measured timing captured for latency-sensitive stories
- route/adapter bridges verified with non-default submitted values when visible UI depends on them

## Step 7: Sync docs

Update the active spec packet, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, and memory files when the story changes durable truth.

## Exit criteria

- Acceptance criteria have corresponding tests
- The chosen test layers follow the smallest-viable-layer rule
- RED occurred before implementation
- GREEN is validated
- Refactor happened as a separate step
- Boundary changes have contract coverage
- Broad invariants have property coverage or an explicit reason not to
- High-risk pure logic has a mutation check or an explicit waiver
- Docs, rule sources, eval result, and memory are synced
