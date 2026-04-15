# Trace Brief

## Story

- Story ID: `TTB-212`
- Title: local extraction mode: Ollama-hosted Qwen2.5-VL with degraded-confidence guardrails
- Status: deferred by user on 2026-04-15; no active trace work

## Trace goal

Compare cloud and local extraction on the smallest approved fixture slice that exercises:

- clean label extraction
- warning-fidelity edge cases
- low-quality image handling
- one local-unavailable or local-timeout failure path

## Variables to tune

- local prompt wording only where needed for conservative visual-claim behavior
- model choice if the default local model is too weak or too slow
- any normalization thresholds that translate weak local outputs into bounded uncertainty

## Required metadata

- endpoint surface
- extraction mode
- provider
- prompt profile
- guardrail policy
- latency notes

## Success condition

The local path is not required to beat cloud. It is required to be honest: strong text extraction where possible, explicit low-confidence posture where visual reasoning is weak, and no hidden cross-mode fallback.

## Current note

Do not run trace work for this packet until the user resumes the local-mode story and chooses a concrete model profile to evaluate.
