# Active Context

- Current focus: `TTB-204` warning-marker repair follow-up on `codex/TTB-204-warning-marker-repair`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification`
- Current objective: repair dropped `(1)` / `(2)` government warning clause markers when both canonical warning clauses are clearly present, soften exact-text mismatch warning evidence so it stays reviewer-framed, and make Toolbench batch sample loads use the real dual-image `cola-cloud-all` pack instead of the stale fixture seed
- Current implementation shape: warning-text normalization now has a dedicated helper that restores clause markers in the extraction normalization, warning vote, warning OCR cross-check, warning OCV, and region-OCR merge paths; the repair only activates when the heading plus both canonical clause anchors are present in order; warning exact-text mismatch copy now says the wording may differ and warning sub-check fail iconography collapses to the caution/review treatment the rest of the UI already uses; Toolbench batch sample loads now call the live batch loader directly with the fetched images + CSV
- Current verification state: focused warning suites, focused Toolbench/batch regressions, full repo `npm run test`, `npm run typecheck`, `npm run build`, and `npm run eval:golden` were green before the rebase; this branch is currently being rebased onto the `TTB-WF-002` structure pass so those suites need one post-rebase rerun
- Current durable caution: the marker repair is intentionally narrow and does not synthesize markers when the second canonical warning clause is absent
- GitHub repo and Railway project remain live; this follow-up is local-only and not yet published, and a fresh live COLA refresh is still blocked by the missing `COLACLOUD_API_KEY` in the current shell
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
