# Task Breakdown

## Task 1

- Objective: create the workflow packet and track the maintenance story explicitly
- Dependency: `must-have`
- Validation: `docs/specs/TTB-WF-002/` exists and `docs/process/SINGLE_SOURCE_OF_TRUTH.md` references the story

## Task 2

- Objective: split UI field primitives and repeated drop-zone interaction logic into smaller focused modules
- Dependency: `must-have`
- Validation: `src/client/Intake.tsx` and `src/client/BatchUploadDropZones.tsx` shrink materially while behavior remains unchanged under `npm run test`

## Task 3

- Objective: reduce orchestration-file size by extracting batch workflow and batch session helpers
- Dependency: `must-have`
- Validation: `src/client/useBatchWorkflow.ts` and `src/server/batch-session.ts` become composition-oriented modules with helper extraction and passing tests

## Task 4

- Objective: split tour runtime concerns so action factories, step resolution, and demo fixtures are easier to review
- Dependency: `parallel`
- Validation: `src/client/help-tour-runtime.ts` shrinks materially and the tour runtime tests still pass

## Task 5

- Objective: add a source-size guard for runtime/tooling files
- Dependency: `must-have`
- Validation: the guard passes with no new violations or baseline regressions and fails when a target file newly exceeds 500 lines or a baseline-listed file grows beyond its allowance
