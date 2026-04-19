# Privacy Checklist

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## Checks

- [x] Prompt policy does not add raw application-data fields to model requests beyond the bounded hints already required by the extraction contract.
- [x] No prompt-profile or guardrail module logs raw prompt bodies, raw model responses, filenames, label bytes, or full application payloads.
- [x] OpenAI requests remain Responses-based with `store: false`.
- [x] Gemini requests remain inline-only with provider logging and dataset sharing disabled.
- [x] Trace-driven tuning uses only approved fixtures or sanitized inputs, stays local, and does not persist real user submissions.
- [x] The quick relevance preflight returns only a bounded decision plus aggregate signal booleans and counts; it does not return raw OCR text or durable upload metadata.

## Negative verification

- Inspect prompt assembly for hidden injection of applicant address or other user-entered freeform fields that the model does not need to read the label.
- Inspect new guardrail and route failure paths for payload leakage in error notes or logs.
- Verify route-specific overlays are encoded as internal prompt intent, not as durable per-user state.
- Verify the relevance-preflight logs and payloads expose no raw OCR text, no label bytes, and no persisted filenames.
- Verification note:
  - prompt assembly remains label-only; route intent is carried through endpoint/mode policy selection, not via user-entered application text
  - the new eval and local trace metadata record only route surface, extraction mode, provider, prompt profile, and guardrail policy
  - no external trace service is required or configured; fixture-backed tuning stays local
  - the quick relevance preflight contract stays bounded to `decision`, `confidence`, `summary`, `detectedBeverage`, and aggregate boolean/count signals
