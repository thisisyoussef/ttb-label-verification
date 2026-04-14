# Privacy Checklist

## Story

- Story ID: `TTB-207`
- Title: cloud extraction mode: Gemini-primary with OpenAI fallback and cross-provider validation

## Checks

- [x] Gemini extraction uses inline bytes only; no Files API uploads are introduced.
- [ ] The Gemini project used for this story keeps API logging and dataset sharing disabled.
- [x] OpenAI fallback continues to assert `store: false` on every request.
- [x] No provider path writes raw label bytes, raw model JSON, or application fields to disk or logs.
- [x] Fallback errors do not echo sensitive payload contents.

## Verification notes

- Gemini inline-only proof: `src/server/gemini-review-extractor.ts` builds `inlineData` parts for both `image/*` and `application/pdf` and never calls the Files API.
- OpenAI fallback proof: `src/server/openai-review-extractor.ts` still reads config through `OPENAI_STORE=false` and sends `store: false` on every Responses parse request.
- Logging proof in repo code: `src/server/llm-trace.ts` records only bounded metadata plus summarized outputs; no raw label bytes, application fields, or provider JSON are written to disk.
- Remaining manual gate: the Gemini API key alone does not prove the AI Studio project keeps API logging and dataset sharing disabled, so that check remains open until someone verifies the project settings directly.

## Negative verification

- Gemini Files API retention: files are automatically deleted after 48 hours, so the Files API remains out of bounds for this repo: https://ai.google.dev/gemini-api/docs/files
- Gemini logging/data sharing: logs can persist for 55 days and shared datasets may be used to improve models, so the project must not opt in: https://ai.google.dev/gemini-api/docs/logs-policy
- OpenAI Responses retention: default storage applies unless `store: false` is set, so the fallback adapter must preserve the current invariant: https://developers.openai.com/api/docs/guides/your-data#v1responses

## Notes

- If the only workable Gemini path requires the Files API or enabled logging, the story fails the constitution check and the default must remain OpenAI.
- The code path is privacy-safe; the remaining unchecked item is a release-process verification step, not an implementation gap.
