# Privacy Checklist

## Story

- Story ID: `TTB-209`
- Title: cloud/default Gemini hot-path tuning and latency policy hardening

## Checks

- [x] OpenAI requests remain `store: false`.
- [x] Gemini requests remain inline-only with logging/data-sharing disabled.
- [x] Gemini explicit caching is not used.
- [x] OpenAI extended prompt caching (`24h`) is not used on user-bearing requests.
- [x] Any cache-friendly request shaping relies only on static prefixes and does not create a new durable storage surface for submitted content.
- [x] Priority-tier support, if enabled, does not change the repo’s no-persistence posture.
- [x] Timing artifacts remain numeric/categorical only and do not contain user content.

## Notes

- This story may evaluate priority tiers and cache-friendly prefix structuring, but neither is allowed to override the repo’s privacy rules.
- 2026-04-14 measurement note: the internal latency metadata added for this story records only provider name, attempt, service-tier header, and prompt/thought token counts. It does not record label text, filenames, raw payloads, or application field values.
- 2026-04-14 ship note: raising the default Gemini timeout to `5000 ms` changes only request lifetime, not storage behavior or logging scope.
