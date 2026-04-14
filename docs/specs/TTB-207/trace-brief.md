# Trace Brief

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## Hypothesis

A Flash-Lite Gemini multimodal model using inline image/PDF inputs plus structured JSON output can beat the current OpenAI extraction path on an approved sanitized local fixture slice while keeping fallback bounded and privacy-safe.

## Fixture slice

- fixture-backed endpoint eval gate via `LANGSMITH_TRACING=true npm run eval:golden`
- sanitized locally generated PDF slice for provider comparison while `evals/labels/assets/` remains incomplete:
  - one clean spirits label
  - one warning-defect label
  - one blank/no-text label
- one sanitized PNG smoke pass to probe the image path

## Review focus

- field presence and extracted-value coverage
- government warning text completeness
- warning visual-signal quality
- image-quality state selection
- latency distribution for success, fast-fail fallback, and late timeout

## Failure taxonomy

- `coverage-regression`: fewer required fields than OpenAI
- `warning-regression`: weaker warning text or warning-signal extraction
- `schema-drift`: response parses poorly or needs unsupported post-processing
- `slow-success`: Gemini succeeds but exceeds budget
- `late-fallback`: Gemini fails too late for safe OpenAI recovery
- `privacy-violation`: any path requires Files API or enabled logging

## Decision record

- Candidate not frozen as default in this story: `gemini-2.5-flash`
  - Google's official model page did not list PDF support at implementation time, so it was not selected as the repo default for a mixed image/PDF route
- Winning implemented model: `gemini-2.5-flash-lite`
  - official docs listed PDF support
  - sanitized PDF traces beat `gpt-5.4` on all three generated cases
- Representative trace ids from 2026-04-14:
  - Gemini clean PDF: `019d8dd8-eb68-7000-8000-00f57d4bb163` (`4548 ms`)
  - Gemini warning-defect PDF: `019d8dd8-fd2d-7000-8000-05f51737d01d` (`5284 ms`)
  - Gemini blank PDF: `019d8dd9-11d2-7000-8000-0411fc54735a` (`4419 ms`)
  - OpenAI clean PDF: `019d8dd9-2316-7000-8000-017b21052661` (`11612 ms`)
  - OpenAI warning-defect PDF: `019d8dd9-5073-7000-8000-0031fa1af0c8` (`11394 ms`)
  - OpenAI blank PDF: `019d8dd9-7cf7-7000-8000-005291833e6e` (`9920 ms`)
- Additional smoke evidence:
  - sanitized clean PDF with the current default `GEMINI_TIMEOUT_MS=3000` timed out locally at roughly `3082 ms`
  - sanitized clean PNG with the current default `GEMINI_TIMEOUT_MS=3000` timed out locally at roughly `3051 ms`
  - sanitized clean PNG with a temporary `GEMINI_TIMEOUT_MS=12000` succeeded on trace `019d8dd7-9a5e-7000-8000-048df4e683b2` in `10041 ms`
- Outcome:
  - Gemini Flash-Lite is the better cloud primary on the sanitized PDF slice and preserved the expected no-text behavior.
  - The current `3000 ms` timeout is too aggressive for the measured sanitized slice, and the image smoke pass still ran far beyond the product target.
  - Do not declare the default production-ready until `TTB-208` adds real stage timing and `TTB-209` tunes the hot path and timeout/deadline policy.
