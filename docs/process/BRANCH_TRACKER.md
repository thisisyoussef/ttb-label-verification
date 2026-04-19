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
| `codex/TTB-000-dynamic-verdict-banner` | `TTB-000` | `codex` | `draft-local` | make the verdict banner follow the live matched/review state and remove overly optimistic review copy | - | `2026-04-18` | `2026-04-18` | `origin/main` | isolated merge worktree for verdict banner fix |
| `codex/TTB-000-verify-tour-boundary` | `TTB-000` | `codex` | `ready-pr` | fix the guided-tour spotlight boundary, collapse toolbench during tours, and replace the loud first-run help popup with a subtle launcher indicator | #123 | `2026-04-19` | `2026-04-19` | `origin/main` | opened from origin/main |
| `codex/TTB-210-alternative-reading-equivalence-publish` | `TTB-210` | `codex` | `draft-local` | keep equivalent verification-mode alternative readings from forcing a needs-review result when they still match the approved value semantically | - | `2026-04-19` | `2026-04-19` | `origin/main` | isolated clean publish worktree |
| `codex/TTB-210-anchor-field-priority` | `TTB-210` | `codex` | `draft-local` | let strong app-backed anchor matches take priority at the field level while keeping the whole-label verdict gated on non-anchor blockers | - | `2026-04-19` | `2026-04-19` | `origin/main` | isolated clean publish worktree |
| `codex/TTB-210-batch-single-source` | `TTB-210` | `codex` | `draft-local` | align batch run and retry item processing to the canonical single-review prompt and inline report pipeline | - | `2026-04-19` | `2026-04-19` | `origin/main` | isolated clean publish worktree at `/Users/youss/Development/gauntlet/ttb-label-verification-210-merge` |
| `codex/TTB-210-refine-upward-only-merge` | `TTB-210` | `codex` | `draft-local` | restrict the post-results refine merge so it only accepts review-to-pass or better-evidenced review-to-review updates and never downgrades approved rows | - | `2026-04-19` | `2026-04-19` | `origin/main` | opened from origin/main |
| `codex/TTB-401-assessor-screenshots` | `TTB-401` | `codex` | `ready-pr` | add evaluator screenshots and a step-by-step testing guide covering single review, toolbench, batch, and latency surfaces | #131 | `2026-04-19` | `2026-04-19` | `origin/main` | isolated clean screenshot worktree at `/Users/youss/Development/gauntlet/ttb-label-verification-ttb401-screenshots` |
| `codex/TTB-401-mermaid-restore` | `TTB-401` | `codex` | `ready-pr` | restore Mermaid-rendered docs and refocus README around assessor-facing architecture, refine, and latency | #130 | `2026-04-19` | `2026-04-19` | `origin/main` | opened from origin/main |
| `codex/TTB-401-submission-pack-merge` | `TTB-401` | `codex` | `draft-local` | merge the evaluator-facing architecture, regulatory, warning, eval, and README documentation packet from the checked-in implementation and artifacts | - | `2026-04-19` | `2026-04-19` | `origin/main` | isolated clean merge worktree at `/Users/youss/Development/gauntlet/ttb-label-verification-ttb401-merge` |
| `codex/TTB-EVAL-002-gemini-batch-golden-set` | `TTB-EVAL-002` | `codex` | `draft-pr` | add an opt-in inline Gemini Batch runner for approved live eval corpus sweeps without touching the canonical fixture gate | `#107` | `2026-04-18` | `2026-04-18` | `origin/main` | isolated eval worktree; dry-run verified on approved 35-case corpus; live Gemini Batch job `batches/zciec1j41bshzbm1n77tufdc3a85ynp9578o` submitted and still provider-side async |
<!-- ACTIVE_BRANCHES:END -->

## Closed branches

<!-- CLOSED_BRANCHES:START -->
| Branch | Story | Lane | Final status | Description | Closed | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `chore/TTB-WF-002-source-size-baseline` | `TTB-WF-002` | `chore` | `merged` | baseline inherited source-size debt so the guard blocks new oversized files and regressions without preventing unrelated story publishes | `2026-04-19` | merged via PR #124 |
| `codex/TTB-204-bold-heading-review` | `TTB-204` | `codex` | `merged` | keep bold-only government warning heading misses in review so uncertain styling calls do not hard-fail the label | `2026-04-19` | merged via PR #126 |
| `codex/TTB-304-dual-image-intake` | `TTB-304` | `codex` | `merged` | carry optional secondary label images through single review, batch matching, toolbench samples, and results evidence without persistence | `2026-04-19` | merged via PR #119 |
| `codex/TTB-401-diagram-polish` | `TTB-401` | `codex` | `merged` | replace raw Mermaid blocks in the architecture docs packet with rendered SVG diagrams while preserving editable Mermaid sources | `2026-04-19` | merged via PR #127 |
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
