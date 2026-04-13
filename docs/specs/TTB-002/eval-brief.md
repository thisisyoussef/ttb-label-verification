# Eval Brief

## Story

- Story ID: `TTB-002`
- Title: single-label compliance engine and recommendation API

## AI behavior being changed

This story introduces the real extraction, validator orchestration, and recommendation path for the single-label flow.

## Expected gain

- Replace the seed report with a real evidence-rich review result
- Catch the showcase government warning errors
- Distinguish cosmetic review cases from true failures
- Expose uncertainty explicitly for low-quality or spatial-judgment cases

## Failure modes to catch

- missing warning defects on the warning-error spirit label
- treating the cosmetic brand mismatch as `fail` instead of `review`
- failing to surface the wine appellation dependency
- missing the forbidden beer ABV format
- upgrading low-quality extraction to `pass`
- missing or malformed evidence payloads for the approved UI
- exceeding the single-label latency budget

## Eval inputs or dataset slice

- all six baseline cases in `evals/labels/manifest.template.json`

## Pass criteria

- every baseline case returns the expected top-level recommendation
- the warning-defect case exposes warning detail evidence
- the cosmetic mismatch case returns `review`
- the low-quality case remains explicit about uncertainty
- the response contract supports the `TTB-001` UI surfaces without structural changes
- measured latency is recorded and stays within the target budget
