# Active Context

- Current focus: `TTB-204` government warning pass-retune follow-up on `codex/TTB-204-warning-pass-retune`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification-ttb204-warning-diagnostics`
- Current objective: restore rightful government-warning exact-text passes after the April 19 strictness regression without weakening real wording defects
- Current implementation shape: exact-text now passes when a pass-grade warning signal exists, no signal directly fails, similarity stays high, and the diff contains no lexical insert/delete defects; heading-format enforcement remains scoped to the opening heading
- Current verification state: focused warning unit tests, full `npm run test`, `npm run typecheck`, `npm run build`, and full `npm run eval:golden` are green
- Current mutation state: `src/server/government-warning-vote.ts` retains a `100%` mutation score with `0` survivors; `src/server/government-warning-subchecks.ts` remains weak (`51.52%`, `77` survivors, `109` errors)
- Current durable caution: the subchecks helper still needs stronger direct assertions around heading detection, low-confidence legibility branches, and reason-bearing branches even though the functional warning gates are now green
- Warning diagnostics artifacts remain in `evals/results/2026-04-19-warning-diagnostics-*.json` as the baseline evidence for this retune
- GitHub repo and Railway project remain live; the checked-in deploy flow still uses GitHub Actions plus Railway CLI
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
