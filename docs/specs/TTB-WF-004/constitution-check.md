# Constitution Check

## Story

- Story ID: `TTB-WF-004`
- Title: automatic production promotion after verified staging deploy

## Scope check

This story changes deployment automation, workflow docs, and release bookkeeping. It does not change product runtime behavior or review logic.

- No persistence rule: unchanged
- Responses API and `store: false`: unchanged
- Deterministic validator ownership: unchanged
- Shared-contract ownership: unchanged
- User-facing latency and compliance behavior: unchanged

## Why this story is allowed

The current checked-in deploy flow assumes that a workflow-updated `production` branch plus an explicitly dispatched `ci` run will reliably hand off to a second workflow that deploys Railway production. That assumption is not holding in this repo. This story keeps the same GitHub + Railway topology but makes the production promotion path deterministic: the same verified SHA that reaches staging can continue to production without depending on a second workflow fan-out from a `GITHUB_TOKEN` branch update.
