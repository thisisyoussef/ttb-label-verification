# Constitution Check

## Story

- Story ID: `TTB-210`
- Title: persona-centered prompt profiles and endpoint plus mode guardrails
- Lane: Codex-only

## Non-negotiables

- No uploaded label image, application field, batch row, or result may be persisted.
- The model remains extraction-only. Deterministic validators still own final compliance outcomes.
- Prompt and guardrail work must stay user-centered without becoming per-user personalization or storing reviewer behavior.
- OpenAI legs remain Responses-based with `store: false`; Gemini legs remain inline-only with provider logging and data sharing disabled.
- The approved UI and shared `VerificationReport` / `ReviewExtraction` contracts stay stable unless a contract change is explicitly justified and lane-safe.
- Because this story changes prompt behavior on the single-label critical path, `trace-brief.md`, `eval-brief.md`, `privacy-checklist.md`, and `performance-budget.md` are required.

## Lane-specific scope

- In scope: prompt-policy design, endpoint-aware prompt overlays, structural extraction guardrails, route and batch integration points, tests, and packet artifacts.
- Out of scope: UI redesign, new providers beyond the planned Gemini/OpenAI stack, new deterministic compliance rules, and durable storage of prompt/eval artifacts.
