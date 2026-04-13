# Performance Budget

## Story

- Story ID: `TTB-002`
- Title: single-label compliance engine and recommendation API

## Budget

- request parse and validation: `<= 250 ms`
- extraction: `<= 3,000 ms`
- deterministic validation: `<= 250 ms`
- serialization and response shaping: `<= 500 ms`
- total target: `<= 5,000 ms`

## Measurement method

- command or script: story-specific local timing harness plus eval run log
- environment: local development machine first; repeat on the target demo environment before final submission
- sample size: all six baseline labels, with special attention to the low-quality and warning-defect cases

## Current result

- measured total: to be recorded during implementation
- slowest stage: expected to be extraction
- notes: if extraction exceeds budget, reduce prompt complexity before weakening validator behavior

## Gate

- pass/fail threshold: no single-label baseline case should exceed 5 seconds end to end in the target environment
