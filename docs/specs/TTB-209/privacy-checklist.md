# Privacy Checklist

## Story

- Story ID: `TTB-209`
- Title: cloud/default single-label hot-path optimization to `<= 4 seconds`

## Checks

- [ ] OpenAI requests remain `store: false`.
- [ ] Gemini requests remain inline-only with logging/data-sharing disabled.
- [ ] Gemini explicit caching is not used.
- [ ] OpenAI extended prompt caching (`24h`) is not used on user-bearing requests.
- [ ] Any cache-friendly request shaping relies only on static prefixes and does not create a new durable storage surface for submitted content.
- [ ] Priority-tier support, if enabled, does not change the repo’s no-persistence posture.
- [ ] Timing artifacts remain numeric/categorical only and do not contain user content.

## Notes

- This story may evaluate priority tiers and cache-friendly prefix structuring, but neither is allowed to override the repo’s privacy rules.
