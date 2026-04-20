# Task Breakdown

1. [x] Add the story packet and tracker state.
   - Files: `docs/specs/TTB-EVAL-002/*`, `docs/process/SINGLE_SOURCE_OF_TRUTH.md`, `docs/process/BRANCH_TRACKER.md`, `docs/specs/PROJECT_STORY_INDEX.md`, `docs/specs/FULL_PRODUCT_SPEC.md`
   - Validation: packet exists, tracker points at `TTB-EVAL-002`

2. [x] Add a pure Gemini Batch helper seam with RED tests first.
   - Files: `scripts/evals/gemini-batch-extraction.ts`, `scripts/evals/gemini-batch-extraction.test.ts`
   - Validation: focused Vitest run proves request assembly, size guard, and parsing behavior

3. [x] Add the CLI runner.
   - Files: `scripts/evals/run-gemini-batch-extraction-benchmark.ts`
   - Validation: focused runner tests pass; `npx tsx scripts/evals/run-gemini-batch-extraction-benchmark.ts --dry-run` writes a local artifact and prints the approved-corpus summary without submitting

4. [x] Update eval docs and result guidance.
   - Files: `evals/README.md`, `evals/results/README.md`
   - Validation: docs clearly separate canonical golden gate vs opt-in Gemini Batch live eval

5. [x] Run verification and record durable memory.
   - Files: `.ai/memory/project/*.md`, `.ai/memory/session/*.md`
   - Validation: focused Vitest helper/runner tests pass; dry-run artifact recorded; repo-wide verification follows before handoff
