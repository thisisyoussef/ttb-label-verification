# Privacy Checklist

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails

## Checks

- [x] Prompt policy does not add raw application-data fields to model requests beyond the bounded hints already required by the extraction contract.
- [x] No prompt-profile or guardrail module logs raw prompt bodies, raw model responses, filenames, label bytes, or full application payloads.
- [x] OpenAI requests remain Responses-based with `store: false`.
- [x] Gemini requests remain inline-only with provider logging and dataset sharing disabled.
- [x] Trace runs use only approved fixtures or sanitized inputs and do not persist real user submissions.

## Negative verification

- Inspect prompt assembly for hidden injection of applicant address or other user-entered freeform fields that the model does not need to read the label.
- Inspect new guardrail and route failure paths for payload leakage in error notes or logs.
- Verify route-specific overlays are encoded as internal prompt intent, not as durable per-user state.
- Verification note:
  - prompt assembly remains label-only; route intent is carried through endpoint/mode policy selection, not via user-entered application text
  - the new eval and trace metadata record only route surface, extraction mode, provider, prompt profile, and guardrail policy
  - traced publishing is currently blocked by LangSmith auth, but the attempted probe used only fixture-backed input
