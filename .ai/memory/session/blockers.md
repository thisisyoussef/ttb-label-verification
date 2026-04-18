# Blockers

- No current blocker on `TTB-WF-003`; work is active in the clean sibling worktree at `/Users/youss/Development/gauntlet/ttb-label-verification-wf-003-lean`
- Current broader-queue blocker: `TTB-210` traced evidence still cannot publish because the current LangSmith credentials fail with `401 Unauthorized` on `/datasets` in the tracked eval flow and `403 Forbidden` on direct trace upload
- Authoritative live core-six extraction verification is still blocked by the absence of curated internal label files; `evals/labels/assets/` contains synthetic smoke PNGs, but they are not the final source-of-truth corpus
- AI Studio logging and dataset-sharing settings for the Gemini project cannot be verified from repo code or the API key alone; that remains a manual release gate before any production-ready Gemini-default claim
- Known future dependency: rule-ingestion work will need authoritative TTB source normalization before production-grade validators can be completed
- Known future dependency: `TTB-401` remains blocked on `TTB-210`
