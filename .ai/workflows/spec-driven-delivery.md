# Spec-Driven Delivery Workflow

## Purpose

Translate intent into executable engineering work before coding begins.

## When to run

Run for `standard` feature work and significant behavior changes.

## Step 0: Branch hygiene

Before creating packet docs or editing implementation files, confirm the worktree is on a story-scoped branch. If the current branch is `main` or `production`, switch immediately to `<lane>/<story-id>-<summary>` and continue there. If you choose a temporary isolated worktree to avoid unrelated local changes, plan from the start to merge, rebase, or cherry-pick the finished story diff back into the active delivery branch before handoff.

## Step 1: Constitution check

Create `constitution-check.md` from the template and confirm the story does not violate:

- no-persistence rules
- Responses API and `store: false` rules
- deterministic-validator ownership
- shared-contract boundaries
- latency and UX constraints

## Step 2: Feature spec

Create `feature-spec.md` and capture:

- problem statement
- user-facing outcomes
- acceptance criteria
- user journeys and decision points
- edge cases
- out-of-scope

Do not bury implementation details here.

## Step 3: Technical plan

Create `technical-plan.md` and define:

- modules and file paths
- data and API contracts
- dependency boundaries
- observability strategy for step transitions and failure branches
- risk and fallback plan
- testing strategy, including test layers, boundary contracts, invariants/properties, flake hazards, and mutation-worthy modules

## Step 4: Task breakdown

Create `task-breakdown.md` with executable tasks, dependencies, and validation commands.

## Step 5: Optional briefs

- Add `ui-component-spec.md` when UI structure, interaction, or evidence presentation is material.
- Add `user-flow-map.md` when the story has visible runtime behavior, multi-step interaction, or meaningful user-visible branching.
- Add `evidence-contract.md` when the review payload, detail panels, extracted evidence, or confidence semantics change.
- Add `rule-source-map.md` when validator behavior, citation sources, beverage applicability, or severity mapping changes.
- Add `observability-plan.md` when the story has async transitions, uploads, model calls, guided flows, or user-reported state bugs that would benefit from step-level logs.
- Add `privacy-checklist.md` when uploads, model calls, temp files, logs, caches, or ephemeral-data handling change.
- Add `performance-budget.md` when the single-label critical path or latency-sensitive behavior changes.
- Add `eval-brief.md` when AI behavior, grading, extraction quality, or routing changes.

## Step 6: Derive tests from acceptance criteria

Map acceptance criteria directly to tests before coding starts. Name the intended layer for each behavior, call out negative and boundary cases, and note where contract, property, or mutation testing is required. Use `user-flow-map.md` to ensure empty, disabled, loading, failure, retry, cancel, back, reset, and skip branches are covered. For AI or validator stories, also map the relevant eval cases from `evals/golden/manifest.json` and the live subset when needed.

## Exit criteria

- Story work is happening on a story-scoped branch rather than `main` or `production`
- If work was isolated in a side worktree, the completion path back into the active delivery branch is explicit before implementation starts
- Constitution check complete
- Feature spec complete
- Technical plan complete
- Task breakdown complete
- Required relevant artifacts for UI, user-flow mapping, observability, evidence, rule traceability, privacy, performance, or evals added when relevant
- Tests mapped from acceptance criteria
