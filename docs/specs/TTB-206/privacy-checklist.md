# Privacy Checklist

## Story

- Story ID: `TTB-206`
- Title: extraction mode routing foundation and privacy-safe cloud/local provider policy

## Checks

- [ ] OpenAI requests remain on the Responses API with `store: false`.
- [ ] Gemini support is specified as inline-only for this product; no Files API uploads are permitted.
- [ ] The target Gemini project keeps AI Studio logging and dataset sharing disabled.
- [ ] No provider adapter logs raw label bytes, raw prompt bodies, or full raw model responses.
- [ ] Unsupported-provider and privacy-policy failures do not fall through to a second provider automatically.
- [ ] Explicit local-mode selection does not fall through to cloud providers automatically.

## Negative verification

- Gemini Files API stores uploaded files for 48 hours and is therefore disallowed for this proof of concept: https://ai.google.dev/gemini-api/docs/files
- Gemini API logging is opt-in, logs expire after 55 days by default, and shared datasets may be used for product improvement/model training; the project must leave logging disabled: https://ai.google.dev/gemini-api/docs/logs-policy
- OpenAI Responses store data by default unless `store: false` is set, so all OpenAI legs must continue to assert that invariant: https://developers.openai.com/api/docs/guides/migrate-to-responses#additional-differences and https://developers.openai.com/api/docs/guides/your-data#v1responses

## Notes

- This story is the policy layer. The live Gemini extraction adapter arrives in `TTB-207`.
