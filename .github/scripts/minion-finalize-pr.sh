#!/usr/bin/env bash
set -euo pipefail

branch_name="${BRANCH_NAME:?BRANCH_NAME is required}"
base_branch="${BASE_BRANCH:-dev}"
issue_number="${ISSUE_NUMBER:?ISSUE_NUMBER is required}"
pr_title="${PR_TITLE:?PR_TITLE is required}"
max_changed_files="${MAX_CHANGED_FILES:-3}"
repo="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"

case "$branch_name" in
  feature/*|fix/*|chore/*|docs/*|test/*|refactor/*) ;;
  *)
    echo "::error::Unexpected workflow branch name: $branch_name" >&2
    exit 1
    ;;
esac

echo "Claude action branch output: ${CLAUDE_BRANCH_NAME:-<empty>}"
echo "Current branch before PR creation: $(git branch --show-current || true)"
git status --short

git fetch origin "$base_branch"
base_sha=$(git rev-parse "origin/${base_branch}")

if [ "$(git branch --show-current || true)" != "$branch_name" ]; then
  git switch -C "$branch_name"
fi

has_untracked=false
if [ -n "$(git ls-files --others --exclude-standard)" ]; then
  has_untracked=true
fi

if ! git diff --quiet || ! git diff --cached --quiet || [ "$has_untracked" = "true" ]; then
  git config user.name "github-actions[bot]"
  git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
  git add .
  git commit -m "fix: implement issue #${issue_number}"
elif [ "$(git rev-parse HEAD)" = "$base_sha" ]; then
  echo "::error::Minion produced no file changes or commits" >&2
  echo "::error::Claude session id: ${CLAUDE_SESSION_ID:-<empty>}" >&2
  echo "::error::Claude execution file: ${CLAUDE_EXECUTION_FILE:-<empty>}" >&2
  exit 1
fi

changed_count=$(git diff --name-only "${base_sha}...HEAD" | sed '/^$/d' | wc -l | tr -d ' ')
if [ "$changed_count" -gt "$max_changed_files" ]; then
  echo "::error::Minion changed ${changed_count} files, expected at most ${max_changed_files}" >&2
  git diff --name-only "${base_sha}...HEAD" >&2
  exit 1
fi

git push --force-with-lease origin "HEAD:refs/heads/${branch_name}"

find_pr() {
  gh pr list \
    --repo "$repo" \
    --state open \
    --base "$base_branch" \
    --head "$branch_name" \
    --json number,url,body,baseRefName,headRefName
}

pr_json=$(find_pr)
pr_url=$(printf '%s' "$pr_json" | jq -r '.[0].url // ""')

if [ -z "$pr_url" ]; then
  pr_url=$(gh pr create \
    --repo "$repo" \
    --base "$base_branch" \
    --head "$branch_name" \
    --title "$pr_title" \
    --body "Closes #$issue_number")
  pr_json=$(find_pr)
fi

if [ "$(printf '%s' "$pr_json" | jq 'length')" -eq 0 ]; then
  echo "::error::No open pull request found from ${branch_name} to ${base_branch}" >&2
  exit 1
fi

actual_base=$(printf '%s' "$pr_json" | jq -r '.[0].baseRefName')
actual_head=$(printf '%s' "$pr_json" | jq -r '.[0].headRefName')
actual_body=$(printf '%s' "$pr_json" | jq -r '.[0].body // ""')
verified_url=$(printf '%s' "$pr_json" | jq -r '.[0].url')

if [ "$actual_base" != "$base_branch" ]; then
  echo "::error::Minion PR targets ${actual_base} instead of ${base_branch}" >&2
  exit 1
fi

if [ "$actual_head" != "$branch_name" ]; then
  echo "::error::Minion PR head is ${actual_head} instead of ${branch_name}" >&2
  exit 1
fi

if ! printf '%s' "$actual_body" | grep -Fq "Closes #${issue_number}"; then
  echo "::error::Minion PR body does not reference Closes #${issue_number}" >&2
  exit 1
fi

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "url=${verified_url}" >> "$GITHUB_OUTPUT"
fi

echo "Verified Minion PR: $verified_url"
