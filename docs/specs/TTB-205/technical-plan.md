# Technical Plan

## Modules

- `src/server/review/review-report.ts` — integrated comparison, rule, and recommendation builder.
- `src/server/review/review-report.test.ts` — deterministic rule coverage.
- `src/server/index.ts` — wire `/api/review` to extraction + warning + aggregation.
- `src/server/index.test.ts` — route-level regression tests.

## Approach

1. Reuse `ReviewExtraction` as the structured fact boundary.
2. Reuse `buildGovernmentWarningCheck` from `TTB-204`.
3. Add field comparison helpers for exact, cosmetic, and clear mismatches.
4. Add beverage-specific and cross-field checks needed by the proof-of-concept corpus.
5. Aggregate checks into counts, verdict, secondary message, and summary.
6. Keep `/api/review/seed` for explicit scaffold inspection; move `/api/review` to the integrated path.
