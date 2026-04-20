# TTB-210 Relevance Recovery Eval Record

- Date: 2026-04-19
- Branch: `codex/TTB-210-relevance-recovery`
- Scope: soften over-eager internal quick-scan `unlikely-label` decisions while removing the intake gate so Verify runs immediately and readability/non-label messaging stays post-Verify

## Commands

```bash
npx vitest run src/server/review/review-relevance.test.ts src/client/singleReviewFlowSupport.test.ts src/client/ReviewRelevanceBanner.test.tsx
npm run typecheck
npm run build
npm run eval:golden
```

## Result

- Targeted Vitest slice: pass
- `npm run typecheck`: pass
- `npm run build`: pass
- `npm run eval:golden`: one existing warning-route failure remains

## Golden Eval Note

`npm run eval:golden` still reports the known baseline warning-route mismatch:

- `G-02:warning` in `evals/llm/review-surfaces.eval.ts`
  - expected sub-check status: `pass`
  - actual sub-check status: `review`

This follow-up does not change warning-route logic.

## Repo Test Baseline Note

`npm run test` still fails in unrelated long-running and anchor-focused suites outside this relevance follow-up:

- `src/server/llm/llm-trace.test.ts`
- `src/server/index.provider-routing.test.ts`
- `src/server/review/review-pipeline.e2e.test.ts`
- `src/server/anchors/anchor-field-track.e2e.test.ts`

Those failures were not introduced by this quick-scan change set.
