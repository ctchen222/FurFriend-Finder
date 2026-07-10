#!/usr/bin/env bash
set -euo pipefail

branch_type="${BRANCH_TYPE:-fix}"
issue_number="${ISSUE_NUMBER:?ISSUE_NUMBER is required}"
issue_title="${ISSUE_TITLE:-}"
date_part="${DATE:-$(TZ="${TZ:-Asia/Taipei}" date +%y%m%d)}"

case "$branch_type" in
  feature|fix|chore|docs|test|refactor) ;;
  *)
    echo "::error::Unexpected branch type: $branch_type" >&2
    exit 1
    ;;
esac

slug=$(printf '%s' "$issue_title" \
  | tr '[:upper:]' '[:lower:]' \
  | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-+/-/g' \
  | cut -c1-48)

if [ -z "$slug" ]; then
  slug="issue-${issue_number}"
fi

branch_name="${branch_type}/${date_part}-${slug}-${issue_number}"

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  {
    echo "issue_number=${issue_number}"
    echo "branch_name=${branch_name}"
  } >> "$GITHUB_OUTPUT"
fi

echo "$branch_name"
