# Technical Debt

## Current gaps

- The repo now has Gemini-generated synthetic core-six PNGs under `evals/labels/assets/`, but authoritative curated label binaries are still missing; the synthetic set is acceptable for internal smoke runs, not for final production-grade corpus claims.
- The integrated `POST /api/review` path is live, but real-label live corpus execution is still unproven because the current core-six image assets are synthetic fixtures rather than curated internal label examples; `TTB-207` and `TTB-208` therefore still rely on sanitized generated media plus traced route evidence as the interim comparison seam.
- The batch engine is now live and a cloud-mode batch happy path is proven locally, but the client still lacks a dedicated hook-level regression harness for the `live | fixture` source transitions that now gate batch runtime behavior.
- The batch intake shell now covers append and toolbench mode-routing regressions, but it still relies on focused module tests plus manual browser spot-checks rather than one higher-level integration harness across the whole batch intake surface.
- The latest local live warning-route spot-check exceeded the product latency target (`7632 ms` on `/tmp/README.md.png`), so extraction-path performance still needs real-corpus measurement and tuning.
- The new dual-image path is covered by contract and UI regressions, but there is not yet a dedicated live latency benchmark comparing one-image versus two-image review requests against the single-label budget.
- The Gemini cloud adapter is now live with the best measured default profile and a `5000 ms` timeout, but the checked-in 20-case review slice still only reached `13/20` success at that timeout and does not justify a lower public budget.
- The visible report contract still hard-codes `latencyBudgetMs: 5000`; lowering it below that now requires a new measured follow-on rather than another assumption layered onto `TTB-209`.
- `TTB-210` shipped the shared prompt-policy module and OCR relevance preflight, but the new quick-scan path still lacks a broader checked-in latency corpus for borderline non-label uploads, two-image scans, and OCR-failure fallback timings.
- The route-aware fixture gate from `TTB-211` now exists and `TTB-210` landed the shared prompt-policy module, but prompt-profile and guardrail version strings are still code-managed constants rather than externally versioned config.
- The repo no longer depends on LangSmith, but older packet history still references the retired external trace path and should be interpreted as historical evidence rather than active workflow.
- The repo now has a local Gemini key for development, but AI Studio logging and dataset-sharing settings still cannot be verified from code alone; that remains a manual release gate for the Gemini project.
- The current Stryker harness expands `src/server/ai-provider-policy.ts` into 201 mutants with frequent timeouts, so mutation testing that module is still too noisy until the mutation scope or configuration is tightened.
- Targeted mutation coverage for `src/server/government-warning-vote.ts` is still weak (`44.07%` on 2026-04-19, with 89 survivors, 4 timeouts, and 73 errors); the vote-backed warning path is green in Vitest, but it still needs stronger direct assertions around consensus thresholds, conflicting-signal routing, and similarity aggregation.
- Targeted mutation coverage for `src/server/government-warning-subchecks.ts` is still weak (`51.57%` on 2026-04-19, with 61 survivors and 2 timeouts); the warning validator behavior is green in Vitest, but the subcheck helpers still need more direct mutation-killing assertions around heading detection, legibility branches, and message/status seams.
- TTB rule normalization has not been turned into machine-readable source files yet.
- The approved `TTB-105` polish exists as the current release-gate UI baseline, but the release-gate story (`TTB-401`) now also waits on the extraction-mode selector (`TTB-108`) and the user-centered LLM hardening follow-ons after `TTB-107`.

## Process debt

- The story queue now exists, but mirrors and packets still need explicit reconciliation whenever a story moves from `ready-parallel` or `ready-for-codex` into `done`.
- Future feature work should keep the expanded working packets and memory bank aligned with SSOT as soon as status changes land.
