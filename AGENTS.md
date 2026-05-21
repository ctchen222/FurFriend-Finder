# Codex Project Instructions

## Branch And PR Policy

- Implementation work must start from `dev`, not `main`.
- Open implementation pull requests against `dev` first.
- Do not merge, push, or update `main` directly for implementation work.
- Promote changes to `main` only after the user explicitly approves that promotion in the current conversation.
- Do not use GitHub API calls, GitHub CLI commands, or direct Git ref updates to bypass this policy.
- If a hotfix has already landed on `main`, backport the same change to `dev` through a pull request targeting `dev`.

