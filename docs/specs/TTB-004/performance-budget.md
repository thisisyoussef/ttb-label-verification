# Performance Budget

## Story

- Story ID: `TTB-004`
- Title: accessibility, hardening, and submission pack

## Budget

- request parse and validation: `<= 250 ms`
- extraction: `<= 3,000 ms`
- deterministic validation: `<= 250 ms`
- serialization and response shaping: `<= 500 ms`
- total target: `<= 5,000 ms` for single-label review

## Measurement method

- command or script: final smoke-test timing run and eval result log
- environment: local integrated build plus the target demo environment if distinct
- sample size: all six baseline single-label cases plus one representative batch run

## Current result

- measured total: to be recorded during final hardening
- slowest stage: expected extraction stage, verify with measured data
- notes: any polish change that touches the critical path requires a re-check

## Gate

- pass/fail threshold: all six baseline single-label cases remain at or under 5 seconds in the target environment
