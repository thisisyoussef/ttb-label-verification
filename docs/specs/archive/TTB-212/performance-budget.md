# Performance Budget

## Story

- Story ID: `TTB-212`
- Title: local extraction mode: Ollama-hosted Qwen2.5-VL with degraded-confidence guardrails
- Status: deferred by user on 2026-04-15; budget remains planning-only

## Local-mode target

- Cloud mode remains the primary interactive SLA path.
- Local mode is an explicit opt-in deployment-readiness path with its own budget.

## Warm-path target

- intake parse + normalization: `<= 150 ms`
- mode resolution + local request assembly: `<= 200 ms`
- local extraction call: `<= 8,000 ms`
- deterministic validation + report shaping: `<= 500 ms`
- response margin: `<= 650 ms`

Target subtotal: `<= 9,500 ms`

## Cold-path note

If the first request pays a model-load penalty, record it separately. Cold-start time may exceed the warm-path target, but it must be documented explicitly and should not be confused with steady-state reviewer latency.

## Measurement method

- capture warm local-mode timings for:
  - single-label success
  - warning-sensitive label
  - one batch item
- capture at least one cold-load timing separately
- compare the totals with the default cloud path in story artifacts and `evals/results/`

## Current note

No live budget work is active for this packet until the user resumes the local-mode story.
