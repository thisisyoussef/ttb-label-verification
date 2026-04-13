# Harness Memory

The memory tree separates durable repo truths from current-work context.

## Layout

- `project/` — durable architecture, patterns, anti-patterns, and technical debt
- `session/` — active context, blockers, and decisions for the current run of work

## Rules

- Keep memory aligned with checked-in code and docs.
- Move recurring lessons into `project/`.
- Keep `session/` concise and current; do not turn it into an archive.
