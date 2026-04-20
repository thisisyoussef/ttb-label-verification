# Task Breakdown

> Status: deferred by user on 2026-04-15. Do not treat these tasks as in-progress.

1. Extend the extraction router to resolve `cloud` vs `local`
   - Files: `src/server/llm/ai-provider-policy.ts`, `src/server/extractors/review-extractor-factory.ts`
   - Validation: unit tests prove mode resolution and no cross-mode fallback

2. Add the Ollama local extractor
   - Files: `src/server/ollama-review-extractor.ts`, `src/server/ollama-review-extractor.test.ts`
   - Validation: adapter tests cover request shape, normalization, and unavailable-model failures

3. Thread local mode through single-label and batch surfaces
   - Files: `src/server/index.ts`, `src/server/batch/batch-session.ts`
   - Validation: route and batch tests prove the local extractor can drive the existing deterministic pipeline

4. Define degraded-confidence handling for weak visual claims
   - Files: local adapter plus any shared helper needed
   - Validation: tests prove uncertain layout/format claims become lower confidence or `uncertain` signals rather than fabricated certainty

5. Add env/bootstrap and README support
   - Files: `scripts/bootstrap/bootstrap-local-env.ts`, `README.md`
   - Validation: packet and docs explain setup, limitations, and no-cloud execution clearly

6. Run trace, eval, privacy, and timing gates
   - Files: story packet artifacts plus `evals/results/`
   - Validation: cloud vs local comparison is recorded with explicit blockers and tradeoffs
