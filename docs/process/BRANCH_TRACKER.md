# Branch Tracker

Last updated: 2026-04-19

This file is the checked-in branch registry for normal story work.

- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` remains the canonical tracker for story order, active status, blockers, and next-step resolution.
- This file is the canonical tracker for branch lifecycle metadata: branch name, story id, description, status, PR state, and closeout notes.
- Use the `Notes` column for linked worktree paths when a story runs in a sibling worktree.
- The published copy on `main` is the canonical shared view. Story branches must update their own row as soon as they are opened so the tracker merges forward cleanly.
- Use `npm run story:branch -- open ...`, `update ...`, and `close ...` instead of editing the active table by hand unless the helper is blocked.

## Status vocabulary

- `draft-local`: branch exists locally but is not yet published
- `published`: branch is pushed and has no PR yet
- `draft-pr`: branch has a draft PR
- `ready-pr`: branch has a non-draft PR open to `main`
- `merged`: branch merged to `main`
- `abandoned`: branch intentionally closed without merge

## Active branches

<!-- ACTIVE_BRANCHES:START -->
| Branch | Story | Lane | Status | Description | PR | Opened | Updated | Base | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `claude/TTB-000-cola-cloud-variety` | `TTB-000` | `claude` | `draft-local` | shorten the COLA Cloud summary cache, randomize the search query on refresh, bias the pool toward 2+-image records, and periodically surface single-image records so the toolbench "Fetch live" button keeps rotating through the corpus with realistic image-count variety | - | `2026-04-19` | `2026-04-19` | `origin/main` | isolated worktree at `.claude/worktrees/cola-cloud-variety` |
| `claude/TTB-000-organize-docs-salvage` | `TTB-000` | `claude` | `draft-local` | salvage additive docs (ARCHITECTURE.md, CONTRIBUTING.md, docs/assets move, README links) from stale PR #116 reorg; defer structural reorg until fresh pass against current main | - | `2026-04-19` | `2026-04-19` | `origin/main` | cherry-picked 9c5f778b from rewrite/organize-codebase |
| `codex/TTB-WF-003-tracker-sync` | `TTB-WF-003` | `codex` | `draft-local` | sync branch tracker and SSOT with the state of main after the PR #138 consolidation: close every TTB-204/TTB-210/TTB-304/TTB-401/TTB-WF-003/TTB-EVAL-002 branch that is on main, and mark TTB-304 done | - | `2026-04-19` | `2026-04-19` | `origin/main` | isolated tracker-sync worktree at `/private/tmp/ttb-tracker-cleanup` |
<!-- ACTIVE_BRANCHES:END -->

## Closed branches

<!-- CLOSED_BRANCHES:START -->
| Branch | Story | Lane | Final status | Description | Closed | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `chore/TTB-WF-002-source-size-baseline` | `TTB-WF-002` | `chore` | `merged` | baseline inherited source-size debt so the guard blocks new oversized files and regressions without preventing unrelated story publishes | `2026-04-19` | merged via PR #124 |
| `codex/TTB-000-dynamic-verdict-banner` | `TTB-000` | `codex` | `merged` | make the verdict banner follow the live matched/review state and remove overly optimistic review copy | `2026-04-19` | merged via e1084bab on main |
| `codex/TTB-000-verify-tour-boundary` | `TTB-000` | `codex` | `merged` | fix the guided-tour spotlight boundary, collapse toolbench during tours, and replace the loud first-run help popup with a subtle launcher indicator | `2026-04-19` | merged via PR #123 |
| `codex/TTB-204-bold-heading-review` | `TTB-204` | `codex` | `merged` | keep bold-only government warning heading misses in review so uncertain styling calls do not hard-fail the label | `2026-04-19` | merged via PR #126 |
| `codex/TTB-204-warning-golden-diagnostics` | `TTB-204` | `codex` | `merged` | split the real warning corpus by visibility, resolve exact-text vote contradictions, and soften unstable heading-format fails | `2026-04-19` | merged via PR #134 |
| `codex/TTB-204-warning-pass-retune` | `TTB-204` | `codex` | `merged` | restore rightful government warning passes by relaxing exact-text and vote-conflict handling while preserving heading defects | `2026-04-19` | merged via PR #136 |
| `codex/TTB-204-warning-vote-mutation` | `TTB-204` | `codex` | `merged` | raise government warning vote mutation coverage and close surviving branches in warning-vote logic | `2026-04-19` | merged via PR #135 |
| `codex/TTB-210-alternative-reading-equivalence-publish` | `TTB-210` | `codex` | `merged` | keep equivalent verification-mode alternative readings from forcing a needs-review result when they still match the approved value semantically | `2026-04-19` | merged via 97cf2296 on main (also carried through PR #138) |
| `codex/TTB-210-anchor-field-priority` | `TTB-210` | `codex` | `merged` | let strong app-backed anchor matches take priority at the field level while keeping the whole-label verdict gated on non-anchor blockers | `2026-04-19` | merged via PR #133 after an isolated clean publish worktree; local `gate:commit` and `gate:push` stayed blocked by inherited repo-wide source-size violations on unrelated files |
| `codex/TTB-210-batch-single-source` | `TTB-210` | `codex` | `merged` | align batch run and retry item processing to the canonical single-review prompt and inline report pipeline | `2026-04-19` | merged via 704d33aa on main (also carried through PR #138) |
| `codex/TTB-210-refine-upward-only-merge` | `TTB-210` | `codex` | `merged` | restrict the post-results refine merge so it only accepts review-to-pass or better-evidenced review-to-review updates and never downgrades approved rows | `2026-04-19` | merged via b4fffeb5 on main |
| `codex/TTB-210-relevance-recovery-publish` | `TTB-210` | `codex` | `merged` | remove the intake quick-scan warning, let Verify run immediately, and defer non-label/readability messaging to the post-Verify result path | `2026-04-19` | merged via PR #139 |
| `codex/TTB-304-dual-image-intake` | `TTB-304` | `codex` | `merged` | carry optional secondary label images through single review, batch matching, toolbench samples, and results evidence without persistence | `2026-04-19` | merged via PR #119 |
| `codex/TTB-401-assessor-screenshots` | `TTB-401` | `codex` | `merged` | add evaluator screenshots and a step-by-step testing guide covering single review, toolbench, batch, and latency surfaces | `2026-04-19` | merged via PR #131 |
| `codex/TTB-401-diagram-polish` | `TTB-401` | `codex` | `merged` | replace raw Mermaid blocks in the architecture docs packet with rendered SVG diagrams while preserving editable Mermaid sources | `2026-04-19` | merged via PR #127 |
| `codex/TTB-401-mermaid-restore` | `TTB-401` | `codex` | `merged` | restore Mermaid-rendered docs and refocus README around assessor-facing architecture, refine, and latency | `2026-04-19` | merged via PR #130 |
| `codex/TTB-401-submission-pack-merge` | `TTB-401` | `codex` | `merged` | merge the evaluator-facing architecture, regulatory, warning, eval, and README documentation packet from the checked-in implementation and artifacts | `2026-04-19` | merged via 0a67df0a on main |
| `codex/TTB-EVAL-002-gemini-batch-golden-set` | `TTB-EVAL-002` | `codex` | `merged` | add an opt-in inline Gemini Batch runner for approved live eval corpus sweeps without touching the canonical fixture gate | `2026-04-19` | merged via PR #107 |
| `codex/TTB-WF-003-merge-consolidation` | `TTB-WF-003` | `codex` | `merged` | consolidate open TTB-204/TTB-210/TTB-304 follow-ups: wine-field reveal, eager refine, batch review-first wording and simple ETA, no-text OCR exit, Toolbench dual-image sample pack | `2026-04-19` | merged via PR #138; consolidated TTB-204 bold-heading, TTB-210 alternative-reading + preflight + batch-align, TTB-304 batch review-first wording + ETA + dual-image + primary/secondary rename, OCR no-text short-circuit |
| `chore/TTB-WF-003-branch-tracker` | `TTB-WF-003` | `chore` | `merged` | add the branch tracker workflow and enforce branch metadata updates | `2026-04-18` | merged via PR #44 |
| `chore/TTB-WF-003-branch-tracker-conflict-fix` | `TTB-WF-003` | `chore` | `merged` | repair BRANCH_TRACKER merge markers and finalize TTB-WF-003 history | `2026-04-18` | merged via PR #109 |
| `chore/TTB-WF-003-lean-agent-workspace` | `TTB-WF-003` | `chore` | `merged` | simplify agent docs, make direct branch work the default, and keep optional sibling worktrees | `2026-04-18` | merged via PR #103 |
| `chore/TTB-WF-003-slim-ci-flow` | `TTB-WF-003` | `chore` | `merged` | slim CI and PR flow so local publish gates drive routine merges | `2026-04-18` | merged via PR #110 |
| `chore/TTB-WF-003-source-size-gate` | `TTB-WF-003` | `chore` | `merged` | let workflow branches close their own tracker rows without bypassing local gates | `2026-04-18` | merged via PR #104 |
| `chore/TTB-WF-003-tracker-closeout` | `TTB-WF-003` | `chore` | `merged` | allow tracker closeout commits and finalize TTB-WF-003 cleanup | `2026-04-18` | merged via PR #108 |
| `chore/TTB-WF-003-worktree-env-bootstrap` | `TTB-WF-003` | `chore` | `merged` | bootstrap repo-local env for isolated worktrees and keep routine env sync silent | `2026-04-18` | merged via PR #106 |
| `claude/TTB-000-autodetect-and-cleanup` | `TTB-000` | `claude` | `merged` | wire OCR-inferred beverage through SSE so Auto-detect badge updates; remove file size from single-label UI | `2026-04-18` | landed across PRs #76, #77, and #78 |
| `claude/TTB-000-fix-toolbench-scroll` | `TTB-000` | `claude` | `merged` | fix toolbench scroll - move overflow to tabpanel | `2026-04-18` | merged via PR #45 |
| `claude/TTB-000-local-fullarch` | `TTB-000` | `claude` | `merged` | full-stack local pipeline (Ollama VLM + judgment), RunPod deploy, UX polish pass | `2026-04-18` | merged via PR #49; later local history contains reverted perf experiments |
| `claude/TTB-000-ux-compact-verdict-strip` | `TTB-000` | `claude` | `abandoned` | compact verdict strip and severity-sorted field checklist | `2026-04-18` | stale draft PR #48; patch-equivalent UI landed elsewhere |
| `codex/TTB-000-branch-completion` | `TTB-000` | `codex` | `merged` | close stale merged branches and land stranded branch-only fixes | `2026-04-18` | merged via PR #102; landed the ABV mismatch display fix from `claude/TTB-000-abv-diff-decimals` and cleaned stale tracker rows |
| `codex/TTB-210-non-label-fallback` | `TTB-210` | `codex` | `merged` | keep non-label and no-text auto-detect uploads at `unknown` unless the extraction still carries trustworthy alcohol-label evidence | `2026-04-18` | merged via PR #112 |
| `codex/TTB-EVAL-001-corpus-accuracy-merge` | `TTB-EVAL-001` | `codex` | `merged` | expand the real eval corpus and add report-level plus raw extraction benchmark harnesses | `2026-04-18` | merged via PR #47 |
<!-- CLOSED_BRANCHES:END -->

