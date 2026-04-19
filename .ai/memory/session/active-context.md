# Active Context

- Current focus: `TTB-304` Toolbench sample reset follow-up on `codex/TTB-304-toolbench-sample-reset`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification-ttb304-toolbench-sample-reset`
- Current objective: remove Samples-tab layout flicker and clear stale single-review state when loading a new Toolbench sample
- Current implementation shape: Samples tab now reserves the capability-action slot while live/synthetic probes settle, and Toolbench sample loads reset OCR preview, prior report/failure state, forced-failure state, beverage mode, and intake fields before the next sample is shown
- Current verification state: targeted Toolbench tests, full `npm run test`, `npm run typecheck`, and `npm run build` are green
- Current runtime check: local API is running on `http://localhost:8787` and the local Vite UI is running on `http://localhost:5186`
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
