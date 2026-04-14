# Privacy Checklist

## Story

- Story ID: `TTB-211`
- Title: LLM endpoint and mode eval matrix, persona scorecards, and trace regression gates

## Checks

- [ ] Eval artifacts record only bounded technical metadata plus approved fixture identifiers, not raw user submissions.
- [ ] Trace reviews remain fixture-only or sanitized-input only.
- [ ] Persona scorecards do not tempt the repo into capturing reviewer identity or behavioral telemetry.
- [ ] Endpoint/mode/provider/prompt-profile metadata is enough for comparison without storing raw prompt bodies or full model outputs.

## Negative verification

- Inspect eval templates and example run logs for prompt or payload leakage.
- Inspect trace guidance for any wording that would normalize tracing staging or production requests.
