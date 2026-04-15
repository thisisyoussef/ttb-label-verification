# Blockers

- Authoritative live core-six extraction verification is still blocked by the absence of curated internal label files; `evals/labels/assets/` now contains Gemini-generated synthetic smoke PNGs, but they are not the final source-of-truth corpus.
- AI Studio logging and dataset-sharing settings for the Gemini project cannot be verified from repo code or the API key alone; that remains a manual release gate before any production-ready Gemini-default claim.
- Known future dependency: rule-ingestion work will need authoritative TTB source normalization before production-grade validators can be completed.
- Known future dependency: the restricted-network local-mode plan (`TTB-212`) still needs Ollama availability plus a usable local model footprint before it can be exercised.
- Known future dependency: `TTB-210` still needs to replace the current hard-coded prompt-profile and guardrail identifiers with the planned shared policy module before the full hardening sequence can close cleanly.
- Known future dependency: any later push below the current `5000 ms` public budget needs a new measured story; `TTB-209` closed with an explicit non-cutover decision for the abandoned `4000 ms` target.
- Known future dependency: `TTB-401` still remains blocked on the remaining extraction-mode hardening chain (`TTB-212` and `TTB-210`) before the final submission pack can close.
- Current tooling blocker: targeted mutation testing for `src/server/ai-provider-policy.ts` is still noisy under the current Stryker config; the attempted run on 2026-04-14 reached 41% with 16 timeouts before it was aborted.
