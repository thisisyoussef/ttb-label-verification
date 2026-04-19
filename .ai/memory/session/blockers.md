# Blockers

- The warning diagnostic run shows a real data-quality blocker for corpus interpretation: many `cola-cloud-real` assets are front labels that do not visibly include the government warning, so those cases cannot prove warning-reader quality without a paired back-label image.
- The warning-visible slice is still unstable across repeated live runs because the upstream warning readers vary label to label and run to run; after the current fixes the remaining hard failures are no longer heading-format false fails, but single-run exact-text collapses can still occur on labels such as `G-67` when both VLM and OCR fail together.
- The main warning-route regression blocker is resolved: `npm run eval:golden` no longer fails on `G-02:warning`.
- Authoritative live core-six extraction verification is still blocked by the absence of curated internal label files; `evals/labels/assets/` now contains Gemini-generated synthetic smoke PNGs, but they are not the final source-of-truth corpus.
- AI Studio logging and dataset-sharing settings for the Gemini project cannot be verified from repo code or the API key alone; that remains a manual release gate before any production-ready Gemini-default claim.
- Known future dependency: rule-ingestion work will need authoritative TTB source normalization before production-grade validators can be completed.
- Archived-by-user: `TTB-212` local-model work was explicitly scrapped for now and its packet was moved to `docs/specs/archive/TTB-212/`.
- Known future dependency: any later push below the current `5000 ms` public budget needs a new measured story; `TTB-209` closed with an explicit non-cutover decision for the abandoned `4000 ms` target.
- Known future dependency: `TTB-401` still remains blocked on `TTB-210` before the final submission pack can close.
- Current broader-queue blocker: `TTB-210` traced evidence still cannot publish after the batch-to-single prompt/report alignment because the current LangSmith credentials fail with `401 Unauthorized` on `/datasets` in the tracked eval flow and `403 Forbidden` on direct trace upload.
- Current tooling blocker: targeted mutation testing for `src/server/ai-provider-policy.ts` is still noisy under the current Stryker config; the attempted run on 2026-04-14 reached 41% with 16 timeouts before it was aborted.
- Current tooling blocker: targeted mutation testing for `src/server/review-extraction.ts` is currently environment-blocked by disk pressure and Stryker sandbox copy failures (`ENOSPC` in temp space, then `ENOENT` while copying hashed `dist/assets` files), so the fallback fix carries an explicit mutation waiver until the harness is stabilized.
- Current tooling blocker: targeted mutation testing for `src/server/government-warning-subchecks.ts` finished but remains weak (`51.52%`, `77` survivors, `109` errors), so the warning subcheck helper still needs a dedicated mutation-hardening follow-up.
