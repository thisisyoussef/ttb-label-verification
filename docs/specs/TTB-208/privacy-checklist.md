# Privacy Checklist

## Story

- Story ID: `TTB-208`
- Title: cloud/default latency observability and sub-4-second budget framing

## Checks

- [ ] Timing spans record only stage ids, provider ids, outcome classes, and millisecond durations.
- [ ] No raw label text, application field values, filenames, or prompt bodies are written into logs, eval artifacts, or trace notes by the timing path.
- [ ] OpenAI requests remain `store: false`.
- [ ] Gemini requests remain inline-only with logging/data-sharing disabled.
- [ ] No explicit provider caching feature is enabled as part of this instrumentation story.
- [ ] Any debug-only timing surface is environment-gated and does not become a production-facing stable API guarantee.

## Notes

- This story is the measurement foundation only. Any later use of priority tiers, media-resolution tuning, or cache-friendly request shaping must pass its own privacy review in `TTB-209`.
