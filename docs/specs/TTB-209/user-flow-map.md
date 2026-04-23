# User Flow Map

## Story

- Story ID: `TTB-209`
- Title: cloud/default Gemini hot-path tuning and latency policy hardening
- Follow-up: 2026-04-23 first-result timeout hardening

## Goal

Keep edge-case single-label reviews from hanging for tens of seconds or minutes by enforcing a bounded first-result budget while preserving the existing reviewer-facing contract.

## Core branches

### Happy path

1. Reviewer submits one or two label images plus optional application fields.
2. Intake parse and normalization complete.
3. Primary provider succeeds inside the normal tuned window.
4. Deterministic validation, report shaping, and any still-in-budget best-effort helpers complete.
5. Reviewer receives the normal verification report.

### Slow primary, fallback still viable

1. Reviewer submits a label that drives a slow or retryable primary-provider failure.
2. The route checks the remaining first-result budget rather than the old fixed `550 ms` cutoff.
3. If enough budget remains, the fallback provider is allowed to run.
4. The first successful extraction result continues through deterministic validation and report shaping.
5. Reviewer still receives the normal verification report instead of a runaway spinner or minute-long wait.

### Slow primary, budget exhausted

1. Reviewer submits a label and the primary provider consumes the first-result budget without returning a usable extraction.
2. The route does not start a doomed late fallback.
3. The server returns the existing retryable review-error contract.
4. The client keeps the already-running OCR preview behavior as the only interim signal; no new reviewer-facing partial report contract is introduced in this follow-up.

### Extraction succeeds late, sidecar work would extend wall-clock

1. Primary or fallback extraction succeeds near the end of the allowed window.
2. Optional best-effort helper stages that cannot finish inside the remaining budget are skipped or downgraded to their existing safe fallback behavior.
3. Deterministic validation and report shaping still complete.
4. Reviewer receives a report biased toward `review` when the skipped helper would otherwise have produced a stronger claim.

## Non-goals

- No new persistent cache, queue, or background job.
- No new reviewer-visible timeout setting or latency promise.
- No weakening of deterministic rule outcomes or privacy guarantees.
