# User Flow Map

## Story

- Story ID: `TTB-208`
- Title: cloud/default latency observability and sub-4-second budget framing

## Scope

Latency measurement and privacy-safe stage summaries for:

- `POST /api/review`
- `POST /api/review/extraction`
- `POST /api/review/warning`
- per-item execution inside `POST /api/batch/run` and `POST /api/batch/retry`

The public response contracts stay unchanged in this story. Timing data is internal to tests,
eval harnesses, traces, and controlled local diagnostics.

## Single-label review

### Happy path

1. Reviewer uploads one label plus optional application data.
2. Server parses the multipart request and normalizes the intake.
3. Router records provider selection and attempts the primary provider.
4. Primary request assembly and provider wait stages complete successfully.
5. Deterministic warning validation and report shaping run.
6. Reviewer receives the existing verification report contract while the internal timing summary
   records the primary-success path.

### Branches

- Empty:
  - No upload still fails before any provider call and should emit a coherent pre-provider timing
    record.
- Disabled:
  - No new reviewer-facing timing control appears in this story.
- Loading:
  - Timing capture remains in-flight while the request is parsing, routing, calling the provider,
    and shaping the response.
- Success:
  - Primary provider succeeds and no fallback attempt is recorded.
- Fast-fail fallback:
  - Primary provider fails quickly enough for a retryable fallback.
  - Summary records the fast-fail primary attempt, fallback handoff, fallback attempt, and final
    fallback success path.
- Failure:
  - Pre-provider validation or a non-retryable provider failure returns the existing structured
    error response and records a pre-provider-failure or primary-hard-fail path.
- Late-fail retryable:
  - Primary provider fails after the retry budget is already too far spent for a second full
    attempt.
  - Summary records a late-fail handoff outcome and the route returns the existing retryable error.
- Retry:
  - Resubmitting the same label reruns timing capture from a fresh request with a new total.
- Cancel / close:
  - Client cancel/close behavior stays unchanged for single-label routes.
- Back / reset:
  - Existing intake and results navigation remains unchanged.

## Extraction-only surface

### Happy path

1. Reviewer submits one label to `POST /api/review/extraction`.
2. Request parse, intake normalization, provider selection, request assembly, and provider wait are
   captured.
3. Route returns the existing extraction contract.

### Branches

- Fast-fail fallback:
  - Primary failure hands off to the fallback provider and still returns the existing extraction
    contract.
- Failure:
  - Validation or non-retryable provider failure returns the existing review-error payload.
- Late-fail retryable:
  - Retryable late timeout returns the existing retryable review-error payload with no fallback
    provider attempt.

## Warning-only surface

### Happy path

1. Reviewer submits one label to `POST /api/review/warning`.
2. Extraction stages are captured first.
3. Deterministic warning validation timing is captured second.
4. Route returns the existing warning-check contract.

### Branches

- Fast-fail fallback:
  - Primary provider failure falls through to the fallback attempt before warning validation.
- Failure:
  - Pre-provider failure or non-retryable provider failure stops before warning validation.
- Late-fail retryable:
  - Route exits before warning validation when the fallback budget is already spent.

## Batch execution

### Happy path

1. Preflight has already loaded the batch files into memory.
2. Each item normalizes its matched row and label into a single-item intake.
3. Item execution records the same provider-selection, provider-attempt, deterministic-validation,
   and report-shaping spans as the single-label review route.
4. Batch row, summary, and export contracts stay unchanged.

### Branches

- Partial fallback:
  - Some items complete on the primary provider while others use fallback.
- Hard failure:
  - Non-retryable provider failure records a failed item path without leaking row content.
- Late-fail retryable:
  - Item execution records the late-fail path without launching the second provider call.
- Cancel:
  - Cancellation may stop later items from starting; completed items retain coherent timing
    summaries for the work already done.
- Retry:
  - Retried items emit a fresh item-level timing summary.

## Manual verification targets

1. `POST /api/review` emits a primary-success timing summary while still returning the stable
   verification-report contract.
2. `POST /api/review/extraction` emits a fast-fail fallback summary when Gemini fails quickly and
   OpenAI succeeds.
3. `POST /api/review/warning` emits a late-fail retryable summary when the retry window closes
   before fallback can start.
4. Batch item execution emits one timing summary per completed item without changing the batch
   stream or dashboard contracts.
