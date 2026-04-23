# Active Context

- Current focus: `TTB-204` warning-tail-trim follow-up on `codex/TTB-204-warning-tail-trim`
- Current worktree: `/Users/youss/Development/gauntlet/ttb-label-verification`
- Current objective: trim obvious non-warning metadata tails after a complete government warning so URL/social spillover stops blocking exact-text approval
- Current implementation shape: `src/server/validators/government-warning-text.ts` now owns the tail-trim seam for warning display/similarity normalization, `src/server/validators/government-warning-validator.ts` feeds the trimmed display text into exact-text evidence, and `src/server/validators/judgment-field-rules.ts` now uses the same comparison helper as the active warning pipeline
- Current verification state: focused warning-helper tests are green, including the Four Loko-style trailing-domain/social case, the sentence-style extra-prose non-trim case, the active warning validator path, and the legacy pure judgment seam
- Current durable caution: trim only clear metadata-like spillover after a complete canonical warning; sentence-style additional prose must remain visible and should not be silently collapsed into the canonical warning
- GitHub repo and Railway project remain live; this follow-up is still local and unpublished pending full verification, merge, and deploy confirmation
- Current contract anchor: `src/shared/contracts/review.ts`
- Current progress tracker: `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
