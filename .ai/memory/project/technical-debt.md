# Technical Debt

## Current gaps

- Live core-six extraction verification is still waiting on the real label binaries under `evals/labels/assets/`; repo-local OpenAI runtime config is now bootstrapped automatically from the local gauntlet env inventory.
- The integrated `POST /api/review` path is live, but successful live corpus execution is still unproven because the core-six live-eval binaries are missing and the latest no-text smoke attempt returned the extractor's structured `network` error.
- The batch engine is now live, but real successful batch outcomes are still unproven locally because the extractor is still returning structured `network` errors during live item processing.
- The latest local live warning-route spot-check exceeded the product latency target (`7632 ms` on `/tmp/README.md.png`), so extraction-path performance still needs real-corpus measurement and tuning.
- Provider selection is still hard-coded to the OpenAI extractor; `TTB-206` and `TTB-207` are now the planned path for capability routing, Gemini-primary image extraction, and cross-provider fallback.
- The 2026-04-13 env audit did not identify an active repo-local Gemini runtime key, so live Gemini cutover work still depends on bootstrap support plus a usable `GEMINI_API_KEY`.
- TTB rule normalization has not been turned into machine-readable source files yet.
- The approved `TTB-105` polish exists as frozen UI input, but the release-gate story (`TTB-401`) still waits on `TTB-106`, `TTB-107`, and now `TTB-207`.

## Process debt

- The story queue now exists, but mirrors and packets still need explicit reconciliation whenever a story moves from `ready-parallel` or `ready-for-codex` into `done`.
- Future feature work should keep the expanded working packets and memory bank aligned with SSOT as soon as status changes land.
