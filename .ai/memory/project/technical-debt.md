# Technical Debt

## Current gaps

- Live core-six extraction verification is still waiting on the real label binaries under `evals/labels/assets/`; repo-local OpenAI runtime config is now bootstrapped automatically from the local gauntlet env inventory.
- The integrated `POST /api/review` path is live, but real-label live corpus execution is still unproven because the core-six live-eval binaries are missing; `TTB-207` used sanitized generated PDF and PNG fixtures plus LangSmith traces as the interim provider-comparison seam.
- The batch engine is now live, but real successful batch outcomes are still unproven locally because the extractor is still returning structured `network` errors during live item processing.
- The latest local live warning-route spot-check exceeded the product latency target (`7632 ms` on `/tmp/README.md.png`), so extraction-path performance still needs real-corpus measurement and tuning.
- The Gemini cloud adapter is now live, but the current `GEMINI_TIMEOUT_MS=3000` default timed out on sanitized clean PDF and PNG smoke traces; `TTB-208` and `TTB-209` still need to turn the Gemini/OpenAI path into a production-ready budgeted default.
- The visible report contract still hard-codes `latencyBudgetMs: 5000`; `TTB-208` and `TTB-209` are now the planned path for stage timing, sub-4-second tuning, and the eventual `4000` cutover.
- The extractor still relies on one route-agnostic prompt string; `TTB-210` remains the planned path for endpoint-aware and mode-aware prompt policy plus structural guardrails.
- The route-aware fixture gate from `TTB-211` now exists, but prompt-profile and guardrail version strings are still hard-coded until `TTB-210` lands the shared prompt-policy module.
- `langsmith/vitest` route traces currently surface under experiment sessions rather than the repo-default `LANGSMITH_PROJECT` lookup path, so manual trace review still depends on the experiment-id workflow recorded in the `TTB-211` packet.
- The repo now has a local Gemini key for development, but AI Studio logging and dataset-sharing settings still cannot be verified from code alone; that remains a manual release gate for the Gemini project.
- The current Stryker harness expands `src/server/ai-provider-policy.ts` into 201 mutants with frequent timeouts, so mutation testing that module is still too noisy until the mutation scope or configuration is tightened.
- TTB rule normalization has not been turned into machine-readable source files yet.
- The approved `TTB-105` polish exists as the current release-gate UI baseline, but the release-gate story (`TTB-401`) now also waits on the extraction-mode selector (`TTB-108`) and the user-centered LLM hardening follow-ons after `TTB-107`.

## Process debt

- The story queue now exists, but mirrors and packets still need explicit reconciliation whenever a story moves from `ready-parallel` or `ready-for-codex` into `done`.
- Future feature work should keep the expanded working packets and memory bank aligned with SSOT as soon as status changes land.
