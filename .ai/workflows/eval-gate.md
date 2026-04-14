# Eval Gate

## Purpose

Turn AI, validator, and evidence-model changes into checked-in evaluation work instead of relying on intuition.

## When to run

Run when a story changes any of the following:

- extraction prompt or schema
- validator behavior or severity mapping
- recommendation logic
- evidence payloads or detail structure
- confidence handling for uncertain visual checks

## Steps

1. Identify the smallest applicable slice in `evals/golden/manifest.json`.
2. Create or update `eval-brief.md` with the expected gain, failure modes, and pass criteria.
3. If the change introduces a new important scenario, update `evals/golden/manifest.json` or backlog a corpus update.
4. If the story needs live extraction or live eval coverage, map the selected slice to `evals/labels/manifest.json` when possible and confirm the required files exist under `evals/labels/assets/`. If they do not, record the exact missing asset paths instead of calling the whole story generically blocked.
5. Run `npm run evals:validate` after changing eval manifests.
6. If local OpenAI runtime config is needed, run `npm run env:bootstrap` before reporting missing credentials.
7. Run the relevant slice manually or with the available harness.
8. Record the result in `evals/results/<date>-<story-id>.md` using the template:
   - dataset slices used
   - cases run
   - expected vs actual result
   - measured latency
   - blocked live assets, if any
   - regressions
   - follow-up actions
9. Reference the eval result path in QA-style handoff and final acceptance.

## Exit criteria

- Relevant eval slices and cases are named explicitly
- Eval expectations are checked in
- Eval result is checked in
- Regressions are either fixed or called out directly
