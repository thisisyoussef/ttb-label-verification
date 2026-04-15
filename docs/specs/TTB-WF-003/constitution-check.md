# Constitution Check

## Story

- Story ID: `TTB-WF-003`
- Title: branch tracker and story-branch workflow

## Scope check

This story changes the checked-in workflow contract, not the product runtime.

- No persistence rule: unchanged
- Responses API and `store: false`: unchanged
- Deterministic validator ownership: unchanged
- Shared-contract ownership: unchanged
- Latency and user-path constraints: unchanged

## Why this story is allowed

The repo already enforces story-scoped branches and PR-only integration, but it does not yet keep a canonical branch registry with lifecycle metadata. This story adds that workflow layer without weakening the existing branch protections or introducing runtime behavior changes.
