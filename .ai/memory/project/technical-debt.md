# Technical Debt

## Current gaps

- The repo now has Gemini-generated synthetic core-six PNGs under `evals/labels/assets/`, but authoritative curated label binaries are still missing; the synthetic set is acceptable for internal smoke runs, not for final production-grade corpus claims.
- The integrated `POST /api/review` path is live, but real-label live corpus execution is still unproven because the current core-six image assets are synthetic fixtures rather than curated internal label examples; `TTB-207` and `TTB-208` therefore still rely on sanitized generated media plus traced route evidence as the interim comparison seam.
- The batch engine is now live and a cloud-mode batch happy path is proven locally, but the client still lacks a dedicated hook-level regression harness for the `live | fixture` source transitions that now gate batch runtime behavior.
- The batch intake shell now covers append and toolbench mode-routing regressions, but it still relies on focused module tests plus manual browser spot-checks rather than one higher-level integration harness across the whole batch intake surface.
- The latest local live warning-route spot-check exceeded the product latency target (`7632 ms` on `/tmp/README.md.png`), so extraction-path performance still needs real-corpus measurement and tuning.
- The new dual-image path is covered by contract and UI regressions, but there is not yet a dedicated live latency benchmark comparing one-image versus two-image review requests against the single-label budget.
- The stored COLA corpus now includes counterpart assets for 13 of 28 checked-in records, which reduces the old front-only warning-visibility blind spot, but the corpus is still mixed and there has not yet been a re-baselined warning-visible slice run against the expanded stored set.
- The Gemini cloud adapter is now live with the best measured default profile and a `5000 ms` timeout, but the checked-in 20-case review slice still only reached `13/20` success at that timeout and does not justify a lower public budget.
- The repo now relies on measured latency docs instead of a report-level budget field; future latency claims still need fresh traces and updated checked-in evidence rather than hand-edited targets.
- The new internal 8s first-result guard prevents minute-scale outliers in the route path, but the branch still needs a fresh long-tail remote corpus rerun after merge before the repo can claim a measured improvement to p95 or max latency.
- `TTB-210` shipped the shared prompt-policy module and OCR relevance preflight, but the new quick-scan path still lacks a broader checked-in latency corpus for borderline non-label uploads, two-image scans, and OCR-failure fallback timings.
- The route-aware fixture gate from `TTB-211` now exists and `TTB-210` landed the shared prompt-policy module, but prompt-profile and guardrail version strings are still code-managed constants rather than externally versioned config.
- The repo no longer depends on LangSmith, but older packet history still references the retired external trace path and should be interpreted as historical evidence rather than active workflow.
- The repo now has a local Gemini key for development, but AI Studio logging and dataset-sharing settings still cannot be verified from code alone; that remains a manual release gate for the Gemini project.
- The manual `promote-production.yml` workflow now deploys directly to Railway production and syncs the branch after health verification, but it assumes the chosen `source_ref` is already validated; there is still no reusable shared verify-and-deploy workflow that re-runs the full `main` release gate for arbitrary rollback refs.
- The current Stryker harness expands `src/server/llm/ai-provider-policy.ts` into 201 mutants with frequent timeouts, so mutation testing that module is still too noisy until the mutation scope or configuration is tightened.
- Targeted mutation coverage for `src/server/validators/government-warning-vote.ts` now reports a `100.00%` mutation score with `0` survivors on the April 19 warning-pass retune follow-up, but the Stryker run still logged `3` timeouts and `71` errors in the harness accounting; the vote logic itself looks defended, but the mutation harness remains noisy.
- Targeted mutation coverage for `src/server/validators/government-warning-subchecks.ts` remains weak after the April 19 warning-pass retune follow-up (`51.52%`, `77` survivors, `109` errors); the warning validator behavior is green in Vitest, but the subcheck helpers still need more direct mutation-killing assertions around heading detection, legibility branches, and message/status seams.
- TTB rule normalization has not been turned into machine-readable source files yet.
- The approved `TTB-105` polish exists as the current release-gate UI baseline, but the release-gate story (`TTB-401`) now also waits on the extraction-mode selector (`TTB-108`) and the user-centered LLM hardening follow-ons after `TTB-107`.

## Process debt

- The story queue now exists, but mirrors and packets still need explicit reconciliation whenever a story moves from `ready-parallel` or `ready-for-codex` into `done`.
- Future feature work should keep the expanded working packets and memory bank aligned with SSOT as soon as status changes land.
