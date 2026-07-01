# Codex Project Instructions

## Branch And PR Policy

- Implementation work must start from `dev`, not `main`.
- Open implementation pull requests against `dev` first.
- Do not push directly to `dev` or `main`.
- Do not merge pull requests unless the user explicitly approves the merge in the current conversation.
- Promote changes from `dev` to `main` only after the user explicitly approves that promotion in the current conversation.
- Do not use GitHub API calls, GitHub CLI commands, direct Git ref updates, force pushes, or branch deletion commands to bypass this policy.
- If a hotfix has already landed on `main`, backport the same change to `dev` through a pull request targeting `dev`.
