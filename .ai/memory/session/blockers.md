# Blockers

- Live core-six extraction verification is still blocked by the missing binary label files under `evals/labels/assets/`: `perfect-spirit-label.png`, `spirit-warning-errors.png`, `spirit-brand-case-mismatch.png`, `wine-missing-appellation.png`, `beer-forbidden-abv-format.png`, and `low-quality-image.png`.
- AI Studio logging and dataset-sharing settings for the Gemini project cannot be verified from repo code or the API key alone; that remains a manual release gate before any production-ready Gemini-default claim.
- Sanitized LangSmith smoke runs on 2026-04-14 showed the current `GEMINI_TIMEOUT_MS=3000` default timing out on generated clean PDF and PNG labels; `TTB-208` and `TTB-209` must measure and tune the real hot path before the default can be called production-ready.
- Known future dependency: rule-ingestion work will need authoritative TTB source normalization before production-grade validators can be completed.
- Known future dependency: the tighter `<= 4,000 ms` target cannot be claimed until `TTB-208` and `TTB-209` add real stage timing and optimize the hot path against the approved fixture slice.
- Known future dependency: the restricted-network local-mode plan (`TTB-212`) still needs Ollama availability plus a usable local model footprint before it can be exercised.
- Known future dependency: `TTB-210` still needs to replace the current hard-coded prompt-profile and guardrail identifiers with the planned shared policy module before the full hardening sequence can close cleanly.
- Known future dependency: `TTB-401` still remains blocked on Claude completing `TTB-108`.
- Current tooling blocker: targeted mutation testing for `src/server/ai-provider-policy.ts` is still noisy under the current Stryker config; the attempted run on 2026-04-14 reached 41% with 16 timeouts before it was aborted.
