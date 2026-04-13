# Evals

This project treats evaluation as part of the product contract.

## Required corpus

The base corpus is the six-label set described in the product roadmap:

1. perfect spirit label
2. spirit label with warning errors
3. spirit label with cosmetic brand mismatch
4. wine label missing appellation
5. beer label with forbidden ABV abbreviation
6. deliberately low-quality image

## Structure

- `labels/` — corpus manifest and instructions for label assets
- `results/` — checked-in run logs for story-specific eval runs

## Rules

- If a story changes extraction, validators, recommendation logic, or evidence payloads, record an eval run.
- If a story exposes a new important failure mode, update the corpus manifest or create a backlog item to do so.
- Capture measured latency with each eval run for single-label critical-path work.
- Until an automated runner exists, manual eval results are acceptable if they are checked in and reproducible.
