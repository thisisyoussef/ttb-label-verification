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
3. If the current agent is Codex, scan the tracker and queue for any earlier workflow or eval foundation story that is still `ready` or `in progress`. If one exists, finish that foundation story first.
4. If the current agent is Claude, ignore pending Codex-only work and select the tracker's `Next ready for Claude` entry.
5. If the current agent is Codex, look next for tracker-marked approved `TTB-1xx` UI handoffs whose backlog doc is still `ready-for-codex`. If one exists, select the earliest such story before any later blocking `TTB-2xx+` engineering item.
6. If no ready `TTB-1xx` Codex handoff remains, select the tracker's `Next blocking for Codex` entry.
7. Claude does not block just because the global next engineering work belongs to Codex. Codex may still block on missing Claude handoffs or earlier engineering prerequisites for the specific story it is trying to execute.
8. If the next step for the active agent is a manual user action, such as returning Stitch assets or providing visual approval, block and ask for that exact action instead of skipping ahead.
9. Read the selected story packet and expand `story-packet.md` into the standard working docs if the story is moving from planning into implementation.
10. Update `docs/process/SINGLE_SOURCE_OF_TRUTH.md` when the active story, owner, or gate changes.

## Exit criteria

- The active story was selected from checked-in docs.
- No earlier unfinished workflow/eval foundation story was skipped by Codex.
- The chosen story is actually ready for the current lane, and any ready `TTB-1xx` Codex handoffs were preferred before later blocking `TTB-2xx+` work.
- The user is redirected instead of skipped past a manual or lane gate only when that gate applies to the active agent.
