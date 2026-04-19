# Active Context

- Current focus: `TTB-203` low-contrast inverse-label follow-up on `codex/TTB-203-inverse-contrast-ocr`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification-ttb203-inverse-contrast-ocr`
- Current objective: prevent dark-label white-text geography reads from surfacing as standalone applicant-address passes
- Current implementation shape: extractor guardrails now scrub applicant-address values that exactly duplicate `countryOfOrigin` or `appellation`, and the real low-contrast `uncorked-in-mayberry-low-contrast-review.webp` asset is pinned in `review-pipeline.e2e.test.ts`
- Current verification state: targeted guardrail suites, the real-label review pipeline e2e, full `npm run test`, `npm run typecheck`, and `npm run build` are green
- Current mutation state: no mutation run for this follow-up; direct scenario coverage protects the new geography-only scrub branch
- Current durable caution: this follow-up hardens post-extraction shaping only; it does not retune provider prompts or OCR itself
- Current evidence artifact: `evals/results/2026-04-19-TTB-203-low-contrast-address-guardrail.md`
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
