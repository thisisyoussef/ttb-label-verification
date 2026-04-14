# Codex Handoffs

Claude writes approved UI-first handoffs here. Codex consumes them as the engineering queue.

## Rules

- One file per story: `docs/backlog/codex-handoffs/<story-id>.md`
- Do not mark a handoff `ready-for-codex` until the user approved the UI direction
- Record the hard constraints and the flexible areas clearly so Codex knows what must stay intact and what it may refine
- When Stitch was used, include the Stitch image reference and Stitch HTML/code reference
- Include the relevant eval scenarios, privacy constraints, and latency expectations when the UI depends on them
- List every required backend, contract, validator, and test task explicitly
- If Codex discovers a need for a broader redesign, a new screen concept, or a fresh Stitch/user-review loop, add a follow-up item here and return it to Claude

Use `TEMPLATE.md` as the starting point.
