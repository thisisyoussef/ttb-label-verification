# Story Handoff Workflow

## Purpose

Define when to stop and ask for review, what kind of review is needed, and what to hand over for QA-style testing or direct user feedback.

## Handoff types

### 1. Lane redirect handoff

Use when:

- the active agent is in the wrong lane
- a required prerequisite from the other lane is missing
- work must stop before edits so the user can continue in Claude or Codex instead

What to include:

- exact blocker
- exact next agent
- exact files or docs the next agent should use
- exact user action if the blocker is a manual step such as returning Stitch assets

Stop rule:

- Do not continue while lane ownership or prerequisites are wrong. Redirect immediately.

### 2. Direction handoff

Use when:

- the story has a non-obvious product or architecture tradeoff
- a visible UI direction could branch materially
- copy, trust posture, or evidence presentation needs explicit user choice

What to include:

- decision to make
- recommended option
- tradeoffs
- exact files or screens affected

### 3. Stitch prep handoff

Use when:

- the story uses the Stitch-assisted UI flow
- Claude has prepared the screen description but should not implement the final UI until Stitch output exists
- the user needs a concrete prompt/doc to run through Google Stitch manually

What to include:

- exact packet doc path: `docs/specs/<story-id>/stitch-screen-brief.md`
- which screen or route the brief covers
- what the user should run through Stitch
- exactly what the user should return: image reference plus HTML/code reference

Stop rule:

- For Stitch-assisted UI stories, stop after the brief is ready and wait for the user to return the Stitch assets.

### 4. Visual review handoff

Use when:

- the story changes visible UI
- the screen, flow, or evidence presentation is ready enough to inspect
- polish work would be wasted without confirming direction

What to include:

- exact route or local URL
- what to look at
- the specific questions the reviewer should answer
- any seeded data or fixture to use

Stop rule:

- For non-trivial visible UI changes, stop for visual review once the first integrated runnable slice exists.

### 5. UI-to-Codex backlog handoff

Use when:

- Claude finished the approved UI slice for a UI-first story
- the user has already confirmed the visual direction
- Codex must continue engineering without changing the frontend design

What to include:

- exact backlog doc path: `docs/backlog/codex-handoffs/<story-id>.md`
- Stitch image reference and Stitch HTML/code reference when Stitch was used
- approved route or local URL
- files touched in `src/client/**`
- frozen layout, copy, styling, and interaction constraints
- required backend, contract, validator, and test work
- open questions or blockers

Stop rule:

- Codex should not begin a UI-first engineering story until this backlog handoff exists and is marked `ready-for-codex`.

### 6. QA-style handoff

Use when:

- the story changes a repeatable workflow or behavior
- a QA developer or the user should verify exact steps

What to include:

- setup or data assumptions
- exact step-by-step test script
- expected result after each step
- quick "if this fails, check" notes
- changed behavior vs unchanged behavior
- measured latency result vs budget when the story touches the single-label critical path
- privacy verification summary when the story touches uploads, model calls, or ephemeral data
- eval result path when the story changes extraction, validators, or evidence payloads

### 7. Final acceptance handoff

Use when:

- local validation is complete
- requested work is done for the story
- prior review feedback has been incorporated

What to include:

- implementation summary
- validation commands run
- review/test steps
- measured latency evidence when relevant
- privacy and no-persistence verification outcome when relevant
- eval result path and rule-source updates when relevant
- remaining gaps, if any
- updated spec and memory artifact paths

## Default stopping rules

- Do not roll directly into the next story after a completion handoff unless the user explicitly asks to continue or the request already covers a multi-story sequence.
- If the user explicitly asks to continue or move to the next story, resolve that through `.ai/workflows/continue-next-story.md` and `docs/process/SINGLE_SOURCE_OF_TRUTH.md`.
- Use a lane redirect handoff immediately when the active agent cannot proceed in-lane.
- Visible UI stories should normally stop twice:
  1. at the visual review checkpoint
  2. at final acceptance
- Stitch-assisted UI stories should normally stop three times:
  1. at the Stitch prep handoff
  2. at the visual review checkpoint
  3. at final acceptance
- UI-first stories that start in Claude should also produce a `ready-for-codex` backlog handoff between those two checkpoints.
- Pure backend or contract stories can usually go straight to QA-style handoff plus final acceptance.
- Latency-sensitive backend stories should not skip the measured QA-style handoff.

## Reviewer target

- Use lane redirect handoff when the user is in the wrong agent or a prerequisite from the other lane is missing.
- Use visual review handoff when feedback is about interface, clarity, flow, hierarchy, or trust.
- Use Stitch prep handoff when Claude needs the user to run Google Stitch and return implementation references.
- Use UI-to-Codex backlog handoff when the frontend direction is approved and engineering work must continue behind the fixed UI.
- Use QA-style handoff when feedback is about reproducible behavior.
- Use final acceptance handoff for the actual user decision that the story is ready.

## Exit criteria

- The correct handoff type is used for the story
- Review instructions are concrete and runnable
- The user or reviewer does not need to infer what to inspect
