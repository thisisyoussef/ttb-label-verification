# Technical Plan

## Primary files

- `src/server/index.ts`
- `src/server/index.test.ts`
- `src/server/review/review-intake.ts`
- `src/server/review/review-intake.test.ts`
- `src/client/App.tsx` only if the standalone path should omit `fields`

## Approach

1. Extract request parsing and normalization out of `src/server/index.ts` into a dedicated module.
2. Keep `multer.memoryStorage()` and route-local middleware ownership in `index.ts`.
3. Normalize multipart `fields` into a bounded typed shape:
   - accept missing `fields`
   - treat blank strings as missing
   - trim optional text input
   - preserve beverage type hint separately from whether comparison data exists
4. Keep route behavior simple for now: validate intake, then return the current seed report.
5. If the client is submitting an empty `fields` payload for standalone review, omit that part in a narrow wiring change so the API path actually exercises optional application-data intake.

## Risks

- The current worktree already contains unfinished story changes, so patches must stay narrowly scoped.
- Over-normalizing today could bake in assumptions that `TTB-203` or `TTB-205` need to revisit. Keep the normalized intake model small and explicit.

## Validation plan

- RED tests for missing `fields` and normalization behavior
- GREEN by extracting the intake module and adjusting the route/client
- Final repo verification: `npm run test`, `npm run typecheck`, `npm run build`
