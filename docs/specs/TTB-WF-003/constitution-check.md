# Constitution Check

## Story

- Story ID: `TTB-WF-003`
- Title: lean agent workspace and direct-branch story workflow

## Scope check

This story changes workflow docs, branch tooling, and tracked repo metadata. It does not change product runtime behavior.

- No persistence rule: unchanged
- Responses API and `store: false`: unchanged
- Deterministic validator ownership: unchanged
- Shared-contract ownership: unchanged
- User-facing latency and compliance behavior: unchanged

## Why this story is allowed

The current repo contract is over-specified and over-relies on spec-driven workflow. This story keeps SSOT and memory bank discipline while removing unnecessary workflow sprawl, making direct branch work the default again, and preserving sibling worktrees only as an optional isolation tool.
