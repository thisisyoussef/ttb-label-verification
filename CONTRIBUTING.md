# Contributing

Welcome. This file is a short on-ramp for new contributors. The canonical operating contract lives in [`AGENTS.md`](AGENTS.md); this doc just points you at the right reading order.

## If you're a human contributor

1. Read the [`README.md`](README.md) to understand the pipeline and why it's shaped the way it is.
2. Skim [`ARCHITECTURE.md`](ARCHITECTURE.md) for the directory map.
3. Set up the environment:
   ```bash
   npm install
   cp .env.example .env          # add GEMINI_API_KEY for the cloud track
   npm run dev                   # web on :5176, API on :8787
   ```
4. Run the test suite before and after your change:
   ```bash
   npm test            # unit + integration
   npm run typecheck   # strict TS
   ```
5. Open a PR targeting `main`. CI runs the full suite and deploys `main` to staging automatically (see [`docs/process/DEPLOYMENT_FLOW.md`](docs/process/DEPLOYMENT_FLOW.md)).

## If you're an AI agent (Claude / Codex)

Your operating contract is [`AGENTS.md`](AGENTS.md). Key points:

- Story state lives in `docs/process/SINGLE_SOURCE_OF_TRUTH.md` and `docs/process/BRANCH_TRACKER.md` — read from there, not chat memory.
- Work on a fresh story branch by default; direct work on `main` is blocked by the pre-commit gate.
- Contracts shared between client and server are the source of truth — `src/shared/contracts/review.ts` is the boundary to respect.
- No persistence: no uploaded label image, application data, or verification result may be written to disk or a database.

## Guidelines

### Code style

- Strict TypeScript. No `any` unless the boundary is unavoidable and justified.
- Small, single-purpose modules. See the domain groupings in [`ARCHITECTURE.md`](ARCHITECTURE.md).
- Tests live next to the code (`foo.ts` + `foo.test.ts`).
- Comments only when the _why_ is non-obvious. Well-named identifiers cover the _what_.

### Compliance invariants

- Final verdicts come from deterministic rules, not an LLM opinion.
- Low-confidence visual claims default to `review`, never `approve`.
- The LLM resolver can upgrade `review → pass` only, never `pass → review` and never `→ reject`.
- Every field check carries a 27 CFR citation.

### When you add a new field check

1. Add a `judgeX` function under `src/server/judgment-*` with a CFR citation and a criticality tier.
2. Add its id to `CHECK_TIER_MAP` in `src/server/validators/judgment-scoring.ts`.
3. Wire it into `src/server/review/review-report-field-checks.ts`.
4. Add fixtures to `evals/labels/` if the check needs end-to-end coverage.
5. Add a golden-corpus case to the `cola-cloud-all` slice if the field is mandatory.

### When you change user-facing copy

- Copy that reviewers see comes from `src/client/reviewDisplayAdapter.ts` — _not_ from server summaries. The adapter deliberately rewrites engine-level `reject` / `fail` language into plain-English `review` copy.
- Keep the adapter's tests in `src/client/reviewDisplayAdapter.test.ts` in sync.

## Getting help

- File issues with a minimal reproduction.
- For architecture-level questions, link to the file and line in `src/` — it's easier to discuss than a paraphrase.
- The golden eval log is checked in: `docs/evals/` has the latest runs so you can see what "passing" looks like on the reference corpus.
