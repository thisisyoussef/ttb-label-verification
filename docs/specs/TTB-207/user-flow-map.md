# User Flow Map

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## Scope

Cloud-mode extraction routing for:

- `POST /api/review`
- `POST /api/review/extraction`
- `POST /api/review/warning`
- batch item execution inside `POST /api/batch/run` and `POST /api/batch/retry`

## Single-label review

### Happy path

1. Reviewer submits a label with or without application data.
2. Server resolves `cloud` mode and orders label extraction as `gemini,openai`.
3. Gemini receives inline image or PDF bytes and returns structured JSON.
4. Extraction normalizes into the existing `ReviewExtraction` contract.
5. Warning validation and deterministic report building run unchanged.
6. Reviewer receives the same response shape, now backed by Gemini-first extraction.

### Branches

- Empty:
  - No upload still fails at existing request-validation boundaries before any provider call.
- Disabled:
  - Local mode remains unavailable unless explicitly enabled elsewhere; `TTB-207` does not silently switch into local routing.
- Loading:
  - Review, extraction, warning, and batch items remain in-flight while the router is selecting and calling the cloud provider.
- Success:
  - Gemini succeeds on the first provider attempt and no fallback runs.
- Fast-fail retry:
  - Gemini fails quickly with a retryable cloud failure such as missing configuration, immediate network failure, rate limit, or provider timeout.
  - Router falls through to OpenAI and returns a normal extraction/report payload.
- Failure:
  - Gemini fails with a non-retryable reason such as privacy-boundary violation, unsupported-capability mismatch, or deterministic normalization bug.
  - Router fails closed with a structured review error and does not call OpenAI.
- Late-timeout failure:
  - Gemini times out after the story budget for safe fallback is already spent.
  - Router returns a retryable structured error instead of chaining a second full extraction pass.
- Retry:
  - Reviewer can resubmit the same label after a retryable error; the router reruns provider selection from the start.
- Cancel / close:
  - Client-side cancel/close behavior is unchanged in this story.
- Back / reset:
  - Existing intake-to-results navigation remains unchanged in this story.

## Extraction-only surface

### Happy path

1. Reviewer submits a label to `POST /api/review/extraction`.
2. Router resolves Gemini first.
3. Extraction payload returns with the existing contract shape and a Gemini model id.

### Branches

- Fast-fail retry:
  - Retryable Gemini failure falls through to OpenAI and still returns the extraction contract.
- Failure:
  - Non-retryable Gemini failure returns the structured review error payload.
- Late-timeout failure:
  - Retryable late timeout returns the structured review error payload with no OpenAI second pass.

## Warning-only surface

### Happy path

1. Reviewer submits a label to `POST /api/review/warning`.
2. Router resolves Gemini first and returns extraction.
3. Warning validation runs on the extracted warning evidence and returns the existing warning contract.

### Branches

- Fallback:
  - Retryable Gemini failure falls through to OpenAI before warning validation.
- Failure:
  - Non-retryable or late-timeout Gemini failure returns a structured error before warning validation runs.

## Batch execution

### Happy path

1. Batch item execution reuses the same cloud extractor router.
2. Each item attempts Gemini first.
3. Retryable item-level Gemini failures may fall through to OpenAI.
4. Batch status and export surfaces remain unchanged.

### Branches

- Partial fallback:
  - Some items use Gemini while others fall through to OpenAI.
- Provider outage:
  - Repeated retryable Gemini failures do not bypass the shared router or create a hidden hard-coded provider path.
- Hard failure:
  - Non-retryable provider failures still fail the affected item or batch path without violating privacy policy.

## Manual verification targets

1. `POST /api/review` with non-default application values still returns those values in the final report path after Gemini-primary routing.
2. `POST /api/review/extraction` returns the stable extraction contract on both Gemini-primary and OpenAI-fallback paths.
3. `POST /api/review/warning` returns the stable warning contract on both Gemini-primary and OpenAI-fallback paths.
4. A retryable late timeout does not trigger a second provider call.
