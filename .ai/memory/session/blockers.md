# Blockers

- Live core-six extraction verification is blocked by the missing binary label files under `evals/labels/assets/`: `perfect-spirit-label.png`, `spirit-warning-errors.png`, `spirit-brand-case-mismatch.png`, `wine-missing-appellation.png`, `beer-forbidden-abv-format.png`, and `low-quality-image.png`.
- Local OpenAI runtime config now bootstraps with `npm run env:bootstrap`, but the latest `/api/review` live smoke attempt still returned the extractor's structured `network` error.
- `TTB-301` is complete, but successful live batch outcomes remain blocked by that same extractor connectivity issue.
- The product-level under-5-second target is not yet proven on the live warning path; a local spot-check on 2026-04-13 took `7632 ms` against `/tmp/README.md.png`, so extraction-path latency still needs real-corpus measurement and tuning.
- Known future dependency: rule-ingestion work will need authoritative TTB source normalization before production-grade validators can be completed.
- Known future dependency: live Gemini migration work under `TTB-206` and `TTB-207` still needs repo-local bootstrap support plus a usable `GEMINI_API_KEY` before the cutover can be exercised.
- Known future dependency: `TTB-401` remains blocked on Claude/Codex completing `TTB-106`, `TTB-107`, and `TTB-207`.
