# Technical Plan

## Direct surfaces

- `src/client/useFileDropInput.ts`
- `src/client/batchWorkflowLive.ts`
- `src/client/useBatchWorkflow.ts`
- `src/client/App.tsx`

## Planned changes

1. Add focused client tests for:
   - batch image append behavior
   - toolbench image routing behavior in active batch mode
2. Change live batch image selection so new files can be appended to the current image set and then re-preflighted against the current CSV.
3. Keep replacement semantics explicit at the batch boundary instead of pushing batch-specific merging into the generic file-input hook.
4. Update toolbench direct-image loading in `App.tsx` so it dispatches to batch when batch is the active mode.

## Risks

- Appending images must not leak old preview URLs or leave stale matching state behind.
- Toolbench mode-aware routing must not break the existing single-review direct-load path.
