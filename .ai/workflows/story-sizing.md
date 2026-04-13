# Story Sizing Workflow

## Purpose

Classify a task so tiny bounded changes do not pay the full planning cost and broader work does.

## Step 1: Apply the classifier

A task is `trivial` only when all of these are true:

- the change is tightly bounded
- no public contract changes
- no new dependency or tooling introduction
- no architecture or workflow changes beyond directly affected files
- no persistence, deployment, or config-contract changes

If any condition fails, classify the task as `standard`.

## Step 2: Publish the lane

State explicitly:

- `lane: trivial` or `lane: standard`
- why it qualifies
- which gates are required

## Step 3: Route the work

- `trivial` -> focused edit plus proportionate TDD
- `standard` -> lookup, spec packet, and TDD pipeline

## Exit criteria

- Lane is recorded before implementation starts.
