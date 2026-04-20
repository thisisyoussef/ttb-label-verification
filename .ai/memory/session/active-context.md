# Active Context

- Current focus: `TTB-204` warning-marker repair follow-up on `codex/TTB-204-warning-marker-repair`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification`
- Current objective: repair dropped `(1)` / `(2)` government warning clause markers when both canonical warning clauses are clearly present, soften exact-text mismatch warning evidence so it stays reviewer-framed, and make Toolbench batch sample loads use the real dual-image `cola-cloud-all` pack instead of the stale fixture seed
- Current implementation shape: warning-text normalization now preserves the extracted warning text as-read while a dedicated comparison seam can still treat dropped clause markers as read noise when the heading plus both canonical clause anchors are present in order; warning exact-text mismatch copy now says the wording may differ and warning sub-check fail iconography collapses to the caution/review treatment the rest of the UI already uses; Toolbench batch sample loads now call the live batch loader directly with the fetched images + CSV
- Current verification state: rebased warning-focused suites are green; `npm run typecheck`, `npm run build`, `npm run eval:golden`, and the local publish gates are green; `npm run test` remains noisy in long-path live-label cases, but the timed route/PDF cases and the real-label review-anchor case pass in isolation and the sparse-label anchor case is currently flaky rather than deterministically broken
- Current durable caution: the marker repair is intentionally narrow and does not synthesize markers when the second canonical warning clause is absent
- GitHub repo and Railway project remain live; this follow-up is local-only and not yet published, and a fresh live COLA refresh is still blocked by the missing `COLACLOUD_API_KEY` in the current shell
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
