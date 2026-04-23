# Active Context

- Current focus: `TTB-000` Results left-panel scroll follow-up on `codex/TTB-000-results-left-panel-scroll`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification`
- Current objective: make the review-page Results left rail scroll as one cohesive column so file metadata no longer slides underneath the image gallery
- Current implementation shape: `src/client/ResultsPinnedColumn.tsx` no longer uses a sticky gallery wrapper inside the scrolled aside; the label heading, `LabelImageGallery`, and metadata rows now live in one vertical flow inside the left rail, while a new SSR regression test in `src/client/ResultsPinnedColumn.test.tsx` guards against reintroducing the sticky split
- Current verification state: focused Results tests are green, and a real browser pass on `http://127.0.0.1:5176/` reproduced the dual-image Results view, captured before/after left-rail scroll screenshots, and confirmed the gallery, filenames, type badge, and privacy footer stay in order with no overlap
- Current durable caution: a nested sticky region inside an independently scrolling results sidebar can hide later metadata under the image panel; this surface should remain a single scroll flow unless a future redesign reserves explicit space for separate sticky behavior
- GitHub repo and Railway project remain live; this follow-up is still local and unpublished pending full verification, merge, and deploy confirmation
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
