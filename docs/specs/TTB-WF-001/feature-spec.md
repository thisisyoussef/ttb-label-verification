# Feature Spec

## Story

- Story ID: `TTB-WF-001`
- Title: workflow foundation upgrade

## Problem statement

The repo has a light harness, but it does not yet enforce the default gauntlet workflow for preflight, lookup, sizing, spec-driven delivery, TDD, memory updates, and checked-in progress tracking.

## User-facing outcomes

- Agents working in this repo follow a consistent workflow.
- Standard feature work has a checked-in spec packet.
- Behavior changes must run through RED -> GREEN -> REFACTOR.
- Durable lessons survive in checked-in memory instead of chat only.
- Review and acceptance handoffs cannot claim GitHub visibility until the story branch is actually published.
- Codex maps dependent surfaces before implementation so related flows do not silently regress.
- Agents open a fresh branch whenever a new feature or story begins instead of reusing the previous story branch.

## Acceptance criteria

1. The repo has checked-in workflow docs for lookup, sizing, spec delivery, TDD, and UI flow-mode selection.
2. The repo has a checked-in single source of truth and memory-bank structure.
3. `AGENTS.md` and `.ai/codex.md` enforce the new workflow.
4. The repo has reusable spec templates for future stories.
5. Repo-managed git hooks and a publish gate make unpublished branch state a workflow blocker instead of a reminder.
6. The repo keeps a checked-in evaluator-facing README and submission baseline that document deliverables, approach, tools, assumptions, and evaluation framing from current checked-in truth.
7. The repo treats “published, validated, mergeable, but still unmerged” as a workflow failure for normal story branches, with explicit exceptions for backup and maintenance refs.
8. Story lookup and the Codex checklist require a blast-radius pass before implementation, including dependent help or tour surfaces when a change moves shell, flow, or target-anchor behavior they rely on.
9. Story-start workflows and lane checklists require a fresh story branch whenever a new feature or story begins, even if the current branch is another valid story branch.

## Edge cases

- Small trivial edits should not require the full spec packet.
- UI-only stories should still use the same spec flow when they are non-trivial.
- Workflow docs must not contradict current package commands.
- Blast-radius guidance must name concrete dependent surfaces, not vague “test more” advice.

## Out of scope

- Runtime validator implementation
- Upload handling
- OpenAI adapter implementation
