# Durable Patterns

## Workflow pattern

- Keep the active agent contract lean: SSOT, branch tracker, memory bank, TDD, and clean code are the default read path.
- Claude and Codex are both full agents in this repo. Historical lane-marked packets and handoff docs are context for older stories, not default blockers for new work.
- Default new work to a fresh story branch in the current checkout; use sibling linked worktrees only when parallel isolation is actually needed.
- Prefer `origin/main` as the base for fresh story work unless a different base is intentional.
- Creating a sibling worktree through `npm run story:branch -- open ... --worktree ...` should also bootstrap repo-local `.env` there; use `npm run env:bootstrap` when reopening an older isolated worktree or after env drift.
- Earlier workflow and eval foundation stories are completed before later feature stories.
- `docs/process/SINGLE_SOURCE_OF_TRUTH.md` is the single checked-in tracker for active story, queue order, blockers, and next-step resolution.
- `docs/specs/<story-id>/` is the universal story packet. Specs are optional for small clear changes and expand when the work is large, risky, ambiguous, or cross-cutting.
- Behavior changes use RED -> GREEN -> REFACTOR through `.ai/workflows/tdd-pipeline.md`.
- Prompt, model, tool-call, and agentic LLM stories use trace-driven development through `docs/process/TRACE_DRIVEN_DEVELOPMENT.md` and `.ai/workflows/trace-driven-development.md`, with LangSmith tracing kept off outside explicit local trace runs.
- Direct UI work is the default. Stitch remains optional through `STITCH_FLOW_MODE=direct|automated|manual`; the legacy `claude-direct` value is accepted only as a compatibility alias.
- Story work uses checked-in git gates: story-scoped branches, `npm run gate:commit` before reviewable commits, `npm run gate:push` before reviewable pushes, and PR-only merges to `main`.
- Published story branches auto-open ready PRs, and PR CI stays intentionally light so it acts as a merge backstop rather than a second full workflow engine.
- Done means published and merged when the branch is mergeable; agents should push and merge by default unless the user asks to hold or a concrete blocker exists.

## Product pattern

- Frontend lives in `src/client`, backend in `src/server`, and the typed boundary in `src/shared/contracts`.
- The UI consumes typed review payloads and should not contain compliance logic.
- The server owns model orchestration, deterministic validators, and report building.
- Final compliance outcomes come from deterministic checks over structured extraction, not from a single model verdict.
- Shared contracts are the handshake across the app; keep client fixtures and helpers aligned to those shared types.
- Direct review uses the integrated `POST /api/review` path; staging routes such as `POST /api/review/extraction` and `POST /api/review/warning` remain focused seams for extractor and validator work.
- Batch mode stays in-memory and session-scoped; no DB, queue, or background restore path.
- Cost-sensitive Gemini live eval sweeps reuse the existing extraction request builder and schema normalizer, then send the approved checked-in corpus through Gemini Batch inline requests only. Keep this path separate from `npm run eval:golden` and from any runtime submission surface.
- Low-confidence visual judgments downgrade to `review`.
- Auto-detect beverage fallback should distinguish ambiguous alcohol-label evidence from non-label noise: label-like ambiguous cases may still fall back to `distilled-spirits`, while no-text or sparse non-label outputs stay `unknown`.
- No uploaded labels, application data, or review results are persisted.

## Documentation pattern

- Canonical repo rules live in `AGENTS.md` and `CLAUDE.md`.
- `.ai/` mirrors and operationalizes those rules.
- `docs/process/BRANCH_TRACKER.md` is the checked-in branch registry.
- `.ai/workflows/continue-next-story.md` is the routing algorithm for `continue` and `continue with the next story`.
- `.ai/workflows/story-lookup.md` and `docs/process/CODEX_CHECKLIST.md` require an explicit blast-radius map before implementation.
- `docs/process/DEPLOYMENT_FLOW.md` is the canonical post-story deploy procedure.
- `evals/` stores the required label corpus and run records.
