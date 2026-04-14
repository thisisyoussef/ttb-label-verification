# Evidence Contract

## Story

- Story ID: `TTB-205`

## Additional guarantees

- Non-default submitted application values must survive into the returned comparison rows.
- Warning evidence from `TTB-204` passes through unchanged.
- Cross-field checks remain separate from field checks.
- No-text extraction keeps `checks: []`, `crossFieldChecks: []`, and `verdict: review`.
