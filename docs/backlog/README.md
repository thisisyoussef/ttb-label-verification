# Backlog

This folder holds checked-in queues and handoff artifacts.

## Queues

- `codex-handoffs/` — approved UI-first work that Claude has handed to Codex for engineering

## Status language

Use one of these statuses in handoff docs:

- `draft-ui` — Claude is still shaping the UI
- `awaiting-visual-review` — runnable UI exists and needs user feedback
- `ready-for-codex` — user approved the UI direction and Codex can start story-local engineering or integration work; whether it is the blocking next Codex queue item is decided in `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- `blocked` — needs an answer before work can continue
- `codex-in-progress` — engineering is actively underway against that exact story id; do not use this for sibling-story progress or general umbrella progress
- `done` — engineering and acceptance are complete

## Review model

- Claude stops at visual review and then writes the Codex handoff.
- Codex picks up only `ready-for-codex` handoffs, but the live tracker still decides whether a handoff is the blocking next story or an executable non-blocking parallel item.
- QA-style review and final acceptance happen after Codex completes the engineering story.
