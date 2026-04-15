# Eval Brief

## Story

- Story ID: `TTB-212`
- Title: local extraction mode: Ollama-hosted Qwen2.5-VL with degraded-confidence guardrails

## AI behavior being changed

This story adds a second execution mode for label extraction. The downstream validator pipeline stays the same; only the extraction engine changes.

## Expected gain

- prove the app has a credible restricted-network path
- keep text-based deterministic checks comparable across cloud and local modes
- turn local-mode weakness into explicit `review`-leaning uncertainty instead of incorrect confidence

## Failure modes to catch

- local mode silently falls back to cloud
- local adapter produces malformed structured output
- text extraction regresses so far that deterministic checks become wrong instead of conservative
- local mode overclaims boldness or layout certainty
- PDF inputs fail unclearly

## Eval inputs or dataset slice

- the approved six-label slice used in current cloud evals
- at least one low-quality label
- at least one warning-defect label
- one forced local-unavailable failure case

## Pass criteria

- route and batch tests prove local mode uses the same typed contract
- eval notes clearly separate text-parity wins from formatting/layout degradation
- cloud vs local differences are documented in packet artifacts and later README language
