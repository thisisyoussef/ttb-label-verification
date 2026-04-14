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
- `What Changed`
- `Files or Surfaces Touched`
- `Tests Added or Updated`
- `Validation`
- `Risks`
- `Screenshots or Manual QA`
- `Follow-ups`

## Content rules

- Keep the body production-grade. Do not leave placeholders, one-word fillers, or blank sections.
- Story branch pushes auto-open draft PRs through GitHub Actions. Replace the template body with the real description before marking the PR ready for review.
- If tests were added or updated, list the exact test files and what they cover.
- If no test files changed, say that explicitly and explain why.
- In `Validation`, list the exact commands or checks run and whether they passed.
- If the PR changes visible behavior, include screenshots or a concrete manual QA script unless there is a real reason not to.
- If there are residual risks, waivers, or missing follow-ups, say so plainly.
- Keep the description synced with the actual diff. If the scope changes, update the PR body.

## Enforcement

- GitHub auto-populates the template through `.github/pull_request_template.md`.
- GitHub auto-opens draft story PRs on branch publish when a PR does not already exist.
- The `ci` workflow validates PR descriptions on non-draft `pull_request` events.
- Story PRs are not considered review-ready when the description is incomplete or stale.
