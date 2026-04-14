# Privacy Checklist

## Story

- Story ID: `TTB-212`
- Title: local extraction mode: Ollama-hosted Qwen2.5-VL with degraded-confidence guardrails

## Checklist

- [ ] Local mode does not send label bytes, application fields, or extracted text to cloud providers once `local` is explicitly selected.
- [ ] The default Ollama host is local-only (`127.0.0.1` or container-local), not a public remote endpoint.
- [ ] No adapter logs raw label bytes, prompt bodies, or full raw model responses.
- [ ] PDF compatibility handling, if added, stays in memory only and writes no temporary user-bearing files unless the packet explicitly proves cleanup and no-persistence semantics.
- [ ] Local-mode failures do not trigger silent cross-mode fallback into Gemini or OpenAI.
- [ ] README and release docs explain that the only behavioral difference between modes is the extraction engine, not the deterministic validator pipeline.

## Notes

- Local mode strengthens the Marcus story only if it is genuinely no-cloud when selected. A hidden cloud escape hatch would undermine the whole deployment-readiness claim.
