# Active Context

- Current focus: `TTB-304` Toolbench Upload-tab removal follow-up on `codex/TTB-304-toolbench-upload-tab-remove`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification`
- Current objective: remove the obsolete Toolbench Upload tab, keep the drawer limited to `Samples` and `Actions`, and make legacy persisted `assets` tab state fall back to `samples`
- Current implementation shape: `src/client/toolbench/AssessorToolbench.tsx` now exposes only `Samples` and `Actions`; `src/client/toolbench/useToolbenchState.ts` exports a pure persisted-tab normalizer that maps the removed `assets` tab to `samples`; and the Upload-only component/wiring has been trimmed from `App.tsx` and `useAppToolbench.ts`
- Current verification state: focused Toolbench tests are green, and a real browser check on `http://127.0.0.1:5176/` confirmed the signed-in Toolbench tab bar shows `Samples` and `Actions` with `Upload` absent
- Current durable caution: removing a persisted Toolbench tab requires a normalization seam for old sessionStorage values or the drawer can reopen into a blank panel
- GitHub repo and Railway project remain live; this follow-up is still local and unpublished pending full verification, merge, and deploy confirmation
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
