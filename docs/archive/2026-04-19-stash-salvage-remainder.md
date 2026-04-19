# Stash Salvage — Remainder (2026-04-19)

This patch file (`2026-04-19-stash-salvage-remainder.patch`) preserves the
remaining content of a stash that was captured during the branch-sprawl
consolidation pass on 2026-04-19.

## What already landed on main from this stash

- Government warning body case-insensitive exact-match fix →
  `src/server/government-warning-validator.ts` (merged via PR #143).

## What remains in the patch, and why it did not land

The rest of the stash could not be applied cleanly because it was captured
against a base that predates the `useAppToolbench` refactor now on main.
A blind apply would regress that refactor.

Remaining novel content worth reconsidering in a fresh pass:

1. **BootScreen startup warmup** — `src/client/App.tsx` introduces
   `APP_BOOT_WARMUP_MS = 1200`, a `<BootScreen />` component, and
   `useStartupWarmup()` hook that shows a "Preparing label verification
   experience" panel while fonts + surface assets settle. Useful for
   stabilizing first-paint icon rendering. Needs to be re-authored against
   the current `useAppToolbench` composition.

2. **MANUAL_TEST_SCRIPT.md rewrite** — `docs/qa/MANUAL_TEST_SCRIPT.md` is
   re-authored as a 3:30–4:45 narrated demo walkthrough with timestamped
   sections, replacing the earlier prerequisites-and-steps format. Paired
   with the BootScreen above.

3. **Minor batch-UI polish** — changes to `BatchDashboard`,
   `BatchDashboardTable`, `BatchDrillInShell`, `BatchProcessingSections`,
   and `batch-session.ts` that largely overlap with PR #138's content but
   have small divergences. Likely stale.

## How to reapply

```bash
git apply --3way --include='src/client/App.tsx' docs/archive/2026-04-19-stash-salvage-remainder.patch
# Resolve conflicts against current useAppToolbench composition
# Extract only the BootScreen + useStartupWarmup additions, drop the import churn
```

Or extract individual file diffs with:

```bash
grep -n '^diff --git' docs/archive/2026-04-19-stash-salvage-remainder.patch
```

The patch file is preserved so this session's consolidation work does not
lose the improvements; pick them up in a follow-up when schedule allows.
