# Blockers

- `npm run eval:golden` still has the pre-existing `G-02:warning` route failure (`exact-text` remains `review` where the fixture expects `pass`); the literal-anchor follow-up did not change that warning-only path.
- Authoritative live core-six extraction verification is still blocked by the absence of curated internal label files; `evals/labels/assets/` now contains Gemini-generated synthetic smoke PNGs, but they are not the final source-of-truth corpus.
- AI Studio logging and dataset-sharing settings for the Gemini project cannot be verified from repo code or the API key alone; that remains a manual release gate before any production-ready Gemini-default claim.
- Known future dependency: rule-ingestion work will need authoritative TTB source normalization before production-grade validators can be completed.
- Archived-by-user: `TTB-212` local-model work was explicitly scrapped for now and its packet was moved to `docs/specs/archive/TTB-212/`.
- Known future dependency: any later push below the current `5000 ms` public budget needs a new measured story; `TTB-209` closed with an explicit non-cutover decision for the abandoned `4000 ms` target.
- Known future dependency: `TTB-401` still remains blocked on `TTB-210` before the final submission pack can close.
- Current tooling blocker: targeted mutation testing for `src/server/ai-provider-policy.ts` is still noisy under the current Stryker config; the attempted run on 2026-04-14 reached 41% with 16 timeouts before it was aborted.
- Current tooling blocker: targeted mutation testing for `src/server/review-extraction.ts` is currently environment-blocked by disk pressure and Stryker sandbox copy failures (`ENOSPC` in temp space, then `ENOENT` while copying hashed `dist/assets` files), so the fallback fix carries an explicit mutation waiver until the harness is stabilized.
