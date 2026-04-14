# Trace Brief

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## Hypothesis

A Flash-tier Gemini multimodal model using inline image/PDF inputs plus structured JSON output can match or beat the current OpenAI extraction path on the approved label-verification fixture slice, while keeping fallback bounded and privacy-safe.

## Fixture slice

- start with the smallest approved local slice that exercises:
  - one clean label
  - one warning-text defect
  - one low-quality/no-text case
- expand to the live core-six subset only when the image assets are present

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

- candidate 1: `Gemini 2.5 Flash`
- candidate 2: `Gemini 2.5 Flash-Lite` if latency/cost needs a lighter path
- record the winning traces, measured timings, and rollback condition here during implementation
