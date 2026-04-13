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

1. Identify the relevant cases in `evals/labels/manifest.template.json`.
2. Create or update `eval-brief.md` with the expected gain, failure modes, and pass criteria.
3. If the change introduces a new important scenario, update the label manifest or backlog a corpus update.
4. Run the relevant slice manually or with the available harness.
5. Record the result in `evals/results/<date>-<story-id>.md` using the template:
   - cases run
   - expected vs actual result
   - measured latency
   - regressions
   - follow-up actions
6. Reference the eval result path in QA-style handoff and final acceptance.

## Exit criteria

- Relevant eval cases are named explicitly
- Eval expectations are checked in
- Eval result is checked in
- Regressions are either fixed or called out directly
