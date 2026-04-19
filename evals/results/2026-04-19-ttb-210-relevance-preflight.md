# TTB-210 Relevance Preflight Eval Record

- Date: 2026-04-19
- Branch: `codex/TTB-210-relevance-preflight`
- Scope: OCR-backed `/api/review/relevance` preflight, extraction prefetch gating, local fixture-backed eval path, LangSmith removal

## Commands

```bash
npm run typecheck
npm run test
npm run build
npm run eval:golden
```

## Result

- `npm run typecheck`: pass
- `npm run test`: pass
- `npm run build`: pass
- `npm run eval:golden`: one existing warning-route failure remains

## Golden Eval Note

`npm run eval:golden` still reports:

- `G-02:warning` in `evals/llm/review-surfaces.eval.ts`
  - expected sub-check status: `pass`
  - actual sub-check status: `review`

This branch does not change the warning validator or warning route logic. The failure was present during the TTB-210 publish pass and is recorded here as an existing baseline issue outside the relevance-preflight changes.

## Manual Runtime Check

- Verified the new relevance route returns a lightweight decision and stage timings without invoking the full extractor.
- Verified the intake uses the relevance decision to avoid eager extraction prefetch on obviously irrelevant uploads.
- Verified the single-label intake remains the shipped runtime surface for this branch.
