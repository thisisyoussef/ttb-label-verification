# Active Context

- Current focus: `TTB-304` counterpart-sample reload follow-up on `codex/TTB-304-counterpart-sample-reload`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification-ttb304-counterpart-sample-reload`
- Current objective: reload the stored COLA sample corpus so shipped multi-image handling also has counterpart/back assets in the checked-in eval and Toolbench sample sources
- Current implementation shape: the COLA refresh script can now refresh the existing stored ids in place, persist up to two preferred assets per record, emit `secondary_filename` in batch CSVs, flatten actual batch image cases with `sampleId` and `isSecondary`, and return ordered `images` arrays from `/api/eval/sample` plus the built-in Toolbench fallback
- Current verification state: focused sample-loading and eval-route regressions, adjacent batch CSV/matching regressions, `npm run evals:validate`, full `npm run test`, `npm run typecheck`, `npm run build`, and `npm run gate:commit` are green on this branch after the helper extraction and rebase sync
- Current data refresh state: the stored corpus was refreshed against the same 28 COLA ids and added 13 new counterpart assets across the checked-in WebP and PDF mirrors
- Current durable caution: not every stored record now has a warning-visible counterpart, and regenerating the PDF mirror rewrote existing generated PDFs in addition to adding the new counterpart files
- GitHub repo and Railway project remain live; this follow-up is committed locally and queued for publish/merge
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
