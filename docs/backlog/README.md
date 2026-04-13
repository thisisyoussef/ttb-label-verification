# Backlog

This folder holds checked-in queues and handoff artifacts.

## Queues

- `codex-handoffs/` — approved UI-first work that Claude has handed to Codex for engineering

## Status language

Use one of these statuses in handoff docs:

- `draft-ui` — Claude is still shaping the UI
- `awaiting-visual-review` — runnable UI exists and needs user feedback
- `ready-for-codex` — user approved the UI direction and Codex can start engineering
- `blocked` — needs an answer before work can continue
- `codex-in-progress` — engineering is underway
- `done` — engineering and acceptance are complete

## Review model

- Claude stops at visual review and then writes the Codex handoff.
- Codex picks up only `ready-for-codex` items.
- QA-style review and final acceptance happen after Codex completes the engineering story.
