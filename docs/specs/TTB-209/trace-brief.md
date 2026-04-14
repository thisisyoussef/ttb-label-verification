# Trace Brief

## Story

- Story ID: `TTB-209`
- Title: cloud/default single-label hot-path optimization to `<= 4 seconds`

## Hypothesis

A tuned Gemini-primary extraction profile with a deadline-aware OpenAI fallback can meet the repo’s `<= 4,000 ms` single-label target without losing the structured extraction quality needed by deterministic validators.

## Smallest approved fixture slice

- one clear raster label
- one PDF label
- one low-quality or small-text label

## Variables to test one at a time

- Gemini model choice (`Gemini 2.5 Flash` vs `Gemini 2.5 Flash-Lite`)
- OpenAI fallback profile
- prompt/schema slimming
- Gemini media resolution profile
- optional priority-tier toggles

## Review focus

- provider wait time
- total route time
- warning-text fidelity
- field omission or false-presence drift
- late-fail cutoff correctness

## Winning-output requirement

- record the winning profile
- record the losing profiles and why they failed
- record the rollback trigger if production measurements later drift above the target
