# Contributing to FurFriend Finder

Thank you for your interest in contributing! This document explains how to work with this codebase effectively. Please read it before opening an issue or pull request.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Branch Strategy](#branch-strategy)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Rules](#pull-request-rules)
- [Development Workflow](#development-workflow)
- [Testing Requirements](#testing-requirements)

---

## Code of Conduct

Be respectful. This project is about helping animals find homes — keep that spirit in the codebase too.

---

## Getting Started

1. Fork the repository
2. Clone your fork locally
3. Install dependencies: `npm install`
4. Copy `.env.example` to `.env` and fill in the required values
5. Start the dev server: `npm run dev`

> **Before starting any significant work**, open an issue first to discuss the change. This avoids wasted effort on work that may not be accepted. (Inspired by Vite and Angular's issue-first policy.)

---

## Branch Strategy

This project uses a **two-layer branch model**:

```
main          ← production-ready code only
  └── dev     ← integration branch; all PRs target this
        ├── feat/<short-description>
        ├── fix/<short-description>
        ├── docs/<short-description>
        └── chore/<short-description>
```

### Rules

| Rule | Why |
|------|-----|
| **Never push directly to `main` or `dev`** | Both branches are protected; all changes go through PRs |
| **Always branch off `dev`** | Ensures your work starts from the latest integrated state |
| **One purpose per branch** | Keeps PRs atomic and reviewable |
| **Delete your branch after merge** | Prevents stale branch accumulation |

### Creating a branch

```bash
# Always start from an up-to-date dev
git checkout dev
git pull origin dev

# Create your branch
git checkout -b fix/animal-status-upsert
```

### Merge path

```
feat/* → dev   (your PR)
dev    → main  (release PR, created by maintainers)
```

> Direct pushes to `main` or `dev` are blocked by branch protection rules on GitHub.

---

## Commit Message Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/). Commit messages drive the automatic changelog — a malformed message breaks release notes generation.

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer: e.g. Co-Authored-By, Closes #123]
```

### Types

| Type | When to use |
|------|-------------|
| `feat` | A new feature visible to users |
| `fix` | A bug fix |
| `docs` | Documentation only |
| `style` | Formatting, whitespace — no logic change |
| `refactor` | Code restructure with no feature or bug change |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Build process, dependency updates, tooling |
| `ci` | CI/CD configuration changes |

### Scope (optional but encouraged)

Use the affected module: `db`, `api`, `frontend`, `auth`, `scheduler`, `email`, `middleware`

### Examples

```
feat(api): add pagination cursor to /api/animals endpoint
fix(db): upsert animal status on duplicate sub_id
docs(contributing): add branch strategy section
test(auth): add integration test for failed login redirect
chore(deps): replace ts-node-dev with tsx
```

### Rules

- Subject line: **imperative mood**, lowercase, no period at the end
- Subject line: **72 characters max**
- Reference related issues in the footer: `Closes #42`
- **Breaking changes**: add `!` after the type — `feat(auth)!: remove session-based auth`

---

## Pull Request Rules

### Before opening a PR

- [ ] Your branch is up to date with `dev` (`git pull origin dev --rebase`)
- [ ] All tests pass: `npm test`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] The PR does **exactly one thing** — split unrelated changes into separate PRs (Svelte's atomicity rule)
- [ ] For new features: a GitHub issue exists and has been discussed

### PR title

The PR title must follow the same Conventional Commits format as commit messages:

```
fix(db): sync animal status on daily import
feat(frontend): add warm color theme
```

### PR description

Use the following template (pre-filled when you open a PR):

```markdown
## Summary
- What changed and why (not what files you edited)

## Related Issue
Closes #<issue-number>

## Test plan
- [ ] Step to manually verify the change
- [ ] Edge case checked
```

### PR size

| Size | Guideline |
|------|-----------|
| Small (< 200 lines) | Can be reviewed and merged quickly |
| Medium (200–500 lines) | Include a clear explanation of the approach |
| Large (> 500 lines) | Split if possible; add a walkthrough in the description |

> Large PRs slow down review and increase the chance of missed bugs. When in doubt, split. (Angular and Svelte both enforce this.)

### Review requirements

- All PRs require **at least 1 approving review** before merge
- Bug fixes and docs: 1 reviewer is sufficient
- New features and architecture changes: 2 reviewers required
- The PR author may not merge their own PR

---

## Development Workflow

### Full example

```bash
# 1. Sync your fork
git checkout dev
git pull origin dev

# 2. Create a branch
git checkout -b feat/email-retry-logic

# 3. Make changes, commit incrementally
git add src/Service/mail.ts
git commit -m "feat(email): add exponential backoff on send failure"

# 4. Keep up with dev during long-running work
git fetch origin
git rebase origin/dev

# 5. Push and open PR
git push -u origin feat/email-retry-logic
gh pr create --base dev --title "feat(email): add retry logic for failed notifications"
```

### Addressing review comments

Use fixup commits during review — do **not** force-push rebased history mid-review, as it makes it hard to see what changed:

```bash
git commit --all -m "fixup: address review comments on error handling"
git push
```

Squash before final merge if the maintainer requests it.

---

## Testing Requirements

All PRs must maintain or improve test coverage. Tests live in `src/__test__/` and are split into three layers:

| Layer | Location | Runs against |
|-------|----------|-------------|
| Unit | `src/__test__/unit/` | Mocked dependencies |
| Integration | `src/__test__/integration/` | Real Express app, mocked DB |
| E2E | `src/__test__/e2e/` | Full stack via Playwright |

### Running tests

```bash
# All unit + integration tests
npm test

# Single file (faster during development)
npx jest src/__test__/unit/animal.db.test.ts --no-coverage

# E2E (requires running server)
npx playwright test
```

### What to test

- Every new function or method needs a unit test
- Every new API endpoint needs an integration test
- Bug fixes should include a regression test that would have caught the original bug

> "The change should be well tested and the test suite should pass in its entirety before submission." — Nest.js Contributing Guide

---

## Questions?

Open a [GitHub Discussion](../../discussions) or file an issue tagged `question`. Do not use issues to ask general questions unrelated to the project.
