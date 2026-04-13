#!/usr/bin/env bash

set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required." >&2
  exit 1
fi

repo_slug="${1:-}"
visibility="${2:-private}"

if [[ -z "$repo_slug" ]]; then
  echo "Usage: scripts/bootstrap-github-repo.sh <owner/repo> [private|public]" >&2
  exit 1
fi

if [[ "$visibility" != "private" && "$visibility" != "public" ]]; then
  echo "Visibility must be private or public." >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git init -b main
fi

if ! git config user.name >/dev/null 2>&1 || ! git config user.email >/dev/null 2>&1; then
  echo "Configure git user.name and user.email before bootstrapping the repository." >&2
  exit 1
fi

git branch -M main
git add .

if ! git diff --cached --quiet; then
  git commit -m "chore: bootstrap repository"
fi

gh repo create "$repo_slug" "--$visibility" --source=. --remote=origin --push

git push -u origin main
git push origin main:production
git branch --set-upstream-to=origin/main main

echo "Repository created and production branch bootstrapped."
