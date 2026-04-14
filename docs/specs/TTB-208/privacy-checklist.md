# Privacy Checklist

## Story

- Story ID: `TTB-208`
- Title: cloud/default latency observability and sub-4-second budget framing

## Checks

- [x] Timing spans record only stage ids, provider ids, outcome classes, attempt labels, and millisecond durations.
- [x] No raw label text, application field values, filenames, or prompt bodies are written into logs, eval artifacts, or trace notes by the timing path.
- [x] OpenAI requests remain `store: false`.
- [x] Gemini requests remain inline-only.
- [ ] Gemini project logging/data-sharing disablement still requires manual AI Studio verification.
- [x] No explicit provider caching feature is enabled as part of this instrumentation story.
- [x] Any debug-only timing surface is environment-gated and does not become a production-facing stable API guarantee.

## Notes

- This story is the measurement foundation only. Any later use of priority tiers, media-resolution tuning, or cache-friendly request shaping must pass its own privacy review in `TTB-209`.
- Timing summaries are internal-only: the route contract still exposes `latencyMs` and `latencyBudgetMs`, while detailed stage summaries flow only through the optional observer and the debug console path guarded by `TTB_DEBUG_LATENCY=1`.
- The synthetic image assets under `evals/labels/assets/` are Gemini-generated internal smoke fixtures. They are not authoritative TTB examples and should not be treated as legal-source evidence.
