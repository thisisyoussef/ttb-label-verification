# Eval Brief

## Story

- Story ID: `TTB-201`
- Title: shared review contract expansion and seed fixture alignment

## Expected gain

- The shared contract can represent every approved `TTB-102` results-state surface without falling back to a UI-only model.
- Later engineering stories can reuse one evidence model instead of translating from a scaffold payload.

## Cases to run

1. Seed report parses with verdict, counts, comparison evidence, warning evidence, and cross-field checks.
2. Standalone report parses with skipped comparison evidence and info cross-field state.
3. No-text-extracted report parses with zero counts and empty `checks`.

## Failure modes to watch

- Old `overallStatus` / `recommendation` fields survive in the top-level report
- Warning sub-check arrays parse even when out of canonical order
- No-text reports still require at least one check row
- Client type aliases diverge from the shared contract after expansion

## Pass criteria

- All contract tests pass against the expanded schema
- The seed report is valid against the shared schema
- Final repo verification passes: `test`, `typecheck`, `build`
