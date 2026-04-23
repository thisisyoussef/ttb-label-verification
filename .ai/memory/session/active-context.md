# Active Context

- Current focus: `TTB-304` Toolbench batch sample loader follow-up on `codex/TTB-304-toolbench-batch-load-restore`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification`
- Current objective: restore the missing `Load test batch` action in the Toolbench Samples tab and verify that it still routes into the real `cola-cloud-all` batch intake path
- Current implementation shape: `src/client/toolbench/toolbenchSamplePanelState.ts` once again keeps `'batch-sample'` in the resolved post-probe section order, and `src/client/toolbench/toolbenchSamplePanelState.test.ts` now covers the available/unavailable capability combinations that must still expose the batch loader
- Current verification state: focused section-order and app-level batch handoff tests are green, and local browser verification confirmed the Toolbench Samples tab shows `Load test batch` and switches into Batch Upload with 28 real sample images plus CSV data
- Current durable caution: the batch loader is not capability-dependent; future Toolbench capability placeholders must not hide always-available evaluator actions when async probe results settle
- GitHub repo and Railway project remain live; this follow-up is still local and unpublished pending full verification and merge
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
