# Continue / Next Story Workflow

## Purpose

Resolve `continue` and `continue with the next story` from checked-in project state instead of chat memory.

## Inputs

- `docs/process/SINGLE_SOURCE_OF_TRUTH.md`
- `docs/specs/PROJECT_STORY_INDEX.md`
- the active story packet under `docs/specs/<story-id>/`
- `docs/backlog/codex-handoffs/<story-id>.md` when the story is UI-first and already approved

## Steps

1. Read `docs/process/SINGLE_SOURCE_OF_TRUTH.md` first.
2. If the current agent already owns an in-progress story in that tracker, continue that story.
3. Otherwise, select the tracker's `Next ready for Claude` or `Next ready for Codex` entry for the current agent.
4. If the next ready item belongs to the other lane, block and redirect the user immediately.
5. If the next step is a manual user action, such as returning Stitch assets or providing visual approval, block and ask for that exact action instead of skipping ahead.
6. Read the selected story packet and expand `story-packet.md` into the standard working docs if the story is moving from planning into implementation.
7. Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md` when the active story, owner, or gate changes.

## Exit criteria

- The active story was selected from checked-in docs.
- The chosen story is actually ready for the current lane.
- The user is redirected instead of skipped past a gate when another lane or a manual step is next.
