# Constitution Check

## Story

- Story ID: `TTB-212`
- Title: local extraction mode: Ollama-hosted Qwen2.5-VL with degraded-confidence guardrails

## Lane and ownership

- Codex-only story. It touches server routing, adapters, contracts, tests, evals, privacy docs, deployment notes, and possibly minimal client wiring only after a Claude-approved `TTB-108` handoff exists.

## Non-negotiable constraints

- No uploaded label, application data, or verification result may be persisted.
- Local mode must not make cloud API calls once explicitly selected.
- OpenAI and Gemini privacy rules remain unchanged for cloud mode; local mode adds a separate no-cloud execution path, not an exception to those rules.
- Final compliance outcomes remain deterministic and typed.
- Low-confidence or unsupported local judgments for boldness, separation, continuity, or same-field-of-vision must degrade to `review`, not fabricated certainty.
- The default reviewer path remains the cloud path until local mode proves its own quality and performance envelope.

## Out of scope

- replacing the deterministic validator pipeline
- turning local mode into the default
- adding durable job queues, model caches that persist user-bearing payloads, or remote Ollama endpoints on the public internet
- redesigning the workstation UI outside the approved `TTB-108` handoff
