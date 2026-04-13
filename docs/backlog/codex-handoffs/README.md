# Codex Handoffs

Claude writes approved UI-first handoffs here. Codex consumes them as the engineering queue.

## Rules

- One file per story: `docs/backlog/codex-handoffs/<story-id>.md`
- Do not mark a handoff `ready-for-codex` until the user approved the UI direction
- Freeze the UI constraints clearly so Codex knows what must not change
- When Stitch was used, include the Stitch image reference and Stitch HTML/code reference
- Include the relevant eval scenarios, privacy constraints, and latency expectations when the UI depends on them
- List every required backend, contract, validator, and test task explicitly
- If Codex discovers a required UI change, add a follow-up item here and return it to Claude instead of redesigning the frontend directly

Use `TEMPLATE.md` as the starting point.
