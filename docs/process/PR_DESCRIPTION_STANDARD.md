# PR Description Standard

Use this standard whenever a story branch is opened as a GitHub pull request.

The goal is simple:

- every PR description should be understandable without diff-diving
- every PR description should truthfully state what changed and how it was verified
- reviewers should be able to see test coverage, risk, and follow-up work immediately

## Required sections

Use the checked-in template at `.github/pull_request_template.md`.

Every PR description must include these sections with real content:

- `Summary`
- `Changes`
- `Validation`
- `Risks / Follow-ups`

## Content rules

- Keep the body production-grade. Do not leave placeholders, one-word fillers, or blank sections.
- Story branch pushes auto-open ready PRs through GitHub Actions. Replace the template body with the real description promptly instead of treating the auto-opened PR as a long-lived draft.
- In `Changes`, cover the important workflow, code, or doc surfaces that actually changed.
- In `Validation`, list the exact commands or checks run and whether they passed.
- If the PR changes visible behavior, mention the concrete manual QA or screenshots in the body where they fit naturally.
- If there are residual risks, waivers, or missing follow-ups, say so plainly in `Risks / Follow-ups`.
- Keep the description synced with the actual diff. If the scope changes, update the PR body.

## Enforcement

- GitHub auto-populates the template through `.github/pull_request_template.md`.
- GitHub auto-opens ready story PRs on branch publish when a PR does not already exist.
- There is no separate CI body gate. Keep the description accurate because it is still part of the review contract.
