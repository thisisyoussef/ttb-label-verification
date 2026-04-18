# Technical Debt

## Current gaps

- Some older story packets and backlog docs still contain the previous lane-split wording and will need cleanup over time.
- The source-size guard still relies on a checked-in baseline waiver for inherited oversized files; the long-term fix is to shrink those files and delete them from the baseline.
- The repo now has Gemini-generated synthetic core-six PNGs under `evals/labels/assets/`, but authoritative curated label binaries are still missing; the synthetic set is acceptable for internal smoke runs, not for final production-grade corpus claims.
- `TTB-210` still cannot publish its traced evidence because the current LangSmith auth path fails with `401 /datasets` in the tracked eval flow and `403` on direct trace upload.
- The current Stryker harness remains noisy for `src/server/ai-provider-policy.ts`.
- The new Gemini Batch runner currently targets the approved live `cola-cloud` plus `supplemental-generated` corpus only; if later stories want broader offline sweeps, the corpus expansion and inline-size guard need to be revisited without falling back to the Files API.
- TTB rule normalization has not yet been turned into machine-readable source files.
- PR CI still installs full dependencies for workflow-only and docs-only changes; if it becomes a drag again, the next step is safe path-based narrowing without reintroducing hidden merge automation.

## Process debt

- Mirrors and memory files need occasional cleanup so older lane-split language does not drift back into the active contract.
- Future feature work should keep the expanded working packets and memory bank aligned with SSOT as soon as status changes land.
- The client bundle still warns at roughly 620 kB minified on build. `TTB-304` did not change that baseline, but the results/gallery path remains a likely place to split code later.
