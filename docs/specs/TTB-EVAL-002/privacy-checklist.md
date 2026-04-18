# Privacy Checklist

## Scope

Gemini Batch live eval runner for approved checked-in corpus assets only.

## Required checks

- [x] Runner scope is tooling only. No app route or runtime path uses Gemini Batch.
- [x] Runner operates only on checked-in repo eval manifests/assets.
- [x] Runner uses Gemini Batch inline requests only in this story.
- [x] Runner does not use Gemini Files API.
- [x] Runner does not read ad hoc user-uploaded paths from outside the approved corpus.
- [x] Result artifacts are written locally under `evals/results/`.
- [x] Batch job deletion is part of the runner flow once results are captured.
- [x] No LangSmith tracing is added for this tooling path.

## Notes

- This story intentionally keeps Gemini Batch out of the product runtime.
- The approved corpus contains checked-in eval fixtures and public/derived benchmark assets, not live reviewer submissions.
