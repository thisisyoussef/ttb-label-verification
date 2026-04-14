# Privacy Checklist

## Story

- Story ID: `TTB-207`
- Title: Gemini-primary label extraction with OpenAI fallback and cross-provider validation

## Checks

- [ ] Gemini extraction uses inline bytes only; no Files API uploads are introduced.
- [ ] The Gemini project used for this story keeps API logging and dataset sharing disabled.
- [ ] OpenAI fallback continues to assert `store: false` on every request.
- [ ] No provider path writes raw label bytes, raw model JSON, or application fields to disk or logs.
- [ ] Fallback errors do not echo sensitive payload contents.

## Negative verification

- Gemini Files API retention: files are automatically deleted after 48 hours, so the Files API remains out of bounds for this repo: https://ai.google.dev/gemini-api/docs/files
- Gemini logging/data sharing: logs can persist for 55 days and shared datasets may be used to improve models, so the project must not opt in: https://ai.google.dev/gemini-api/docs/logs-policy
- OpenAI Responses retention: default storage applies unless `store: false` is set, so the fallback adapter must preserve the current invariant: https://developers.openai.com/api/docs/guides/your-data#v1responses

## Notes

- If the only workable Gemini path requires the Files API or enabled logging, the story fails the constitution check and the default must remain OpenAI.
