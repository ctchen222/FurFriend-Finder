# CI Pipeline Implementation Plan

> Date: 2026-03-30
> Goal: Implement the two-phase GitHub Actions workflow (Plan → Approve → Implement)

---

## Pre-requisites

- [x] `scripts/minion.sh` validated locally (183 tests, 0 retries)
- [x] Remote URL updated to `https://github.com/ctchen222/FurFriend-Finder.git`
- [ ] `ANTHROPIC_API_KEY` obtained from console.anthropic.com

---

## Step 1 — Merge feature branch to main

`feature/ai-minion-workflow` contains `CLAUDE.md`, `.claudeignore`, `scripts/minion.sh`, and docs.
GitHub Actions workflows must be on the default branch (main) to be triggered by issue events.

**Action:** Merge or create PR from `feature/ai-minion-workflow` → `main`.

---

## Step 2 — Create `claude-plan` label on GitHub

Go to `github.com/ctchen222/FurFriend-Finder` → Issues → Labels → New label.

- Name: `claude-plan`
- Color: suggested `#0075ca` (blue)
- Description: `Trigger AI to generate an implementation plan`

---

## Step 3 — Add `ANTHROPIC_API_KEY` to GitHub Secrets

1. Go to `console.anthropic.com` → API Keys → Create new key
2. Go to repo Settings → Secrets and variables → Actions → New repository secret
   - Name: `ANTHROPIC_API_KEY`
   - Value: the key from step 1

---

## Step 4 — Create `claude-plan.yml` (Phase 1)

**File:** `.github/workflows/claude-plan.yml`

**Trigger:** Issue labeled with `claude-plan`

**Behavior:** Claude reads the issue, posts a plan comment (no file changes), then stops.

```yaml
name: Claude Plan

on:
  issues:
    types: [labeled]

jobs:
  plan:
    if: github.event.label.name == 'claude-plan'
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: read

    steps:
      - uses: actions/checkout@v4

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          claude_args: "--max-turns 3 --model claude-haiku-4-5-20251001"
          prompt: |
            Read this GitHub issue and output ONLY an implementation plan as a comment.
            Do NOT make any file changes.

            Your plan comment must include:
            1. Files to READ for context
            2. Files to MODIFY and the specific changes
            3. Estimated line count change
            4. Any risks or edge cases

            Format the comment starting with "## Implementation Plan" so it can be
            identified by the implementation workflow.

            Issue title: ${{ github.event.issue.title }}
            Issue body: ${{ github.event.issue.body }}
```

---

## Step 5 — Create `claude-implement.yml` (Phase 2)

**File:** `.github/workflows/claude-implement.yml`

**Trigger:** Issue comment containing exactly `approved`, posted by `ctchen`

**Key design: Phase 2 must read the Phase 1 plan comment and implement it.**
This prevents Phase 2 from inventing a different approach than what was approved.

```yaml
name: Claude Implement

on:
  issue_comment:
    types: [created]

jobs:
  implement:
    if: |
      github.event.comment.body == 'approved' &&
      github.event.comment.user.login == 'ctchen'
    runs-on: ubuntu-latest
    permissions:
      issues: write
      contents: write
      pull-requests: write

    steps:
      - uses: actions/checkout@v4

      - name: Get issue number and create branch name
        id: branch
        run: |
          ISSUE_NUMBER="${{ github.event.issue.number }}"
          SLUG=$(echo "${{ github.event.issue.title }}" \
            | tr '[:upper:]' '[:lower:]' \
            | sed 's/[^a-z0-9]/-/g' \
            | sed 's/--*/-/g' \
            | sed 's/^-\|-$//g' \
            | cut -c1-40)
          BRANCH="feature/${ISSUE_NUMBER}-${SLUG}"
          echo "branch=$BRANCH" >> $GITHUB_OUTPUT
          echo "issue_number=$ISSUE_NUMBER" >> $GITHUB_OUTPUT

      - name: Fetch plan comment from Phase 1
        id: plan
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Find the most recent comment starting with "## Implementation Plan"
          PLAN=$(gh issue view ${{ steps.branch.outputs.issue_number }} \
            --repo ${{ github.repository }} \
            --json comments \
            --jq '[.comments[] | select(.body | startswith("## Implementation Plan"))] | last | .body')
          echo "plan<<EOF" >> $GITHUB_OUTPUT
          echo "$PLAN" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT

      - uses: anthropics/claude-code-action@v1
        with:
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          github_token: ${{ secrets.GITHUB_TOKEN }}
          branch: ${{ steps.branch.outputs.branch }}
          claude_args: "--max-turns 2 --model claude-haiku-4-5-20251001"
          prompt: |
            Implement the following approved plan exactly as described.
            Do not deviate from the plan or add unrequested features.

            Approved plan:
            ${{ steps.plan.outputs.plan }}

            Issue title: ${{ github.event.issue.title }}
            Issue body: ${{ github.event.issue.body }}

            After implementing, open a pull request targeting main with:
            - Title: matching the issue title
            - Body: referencing issue #${{ steps.branch.outputs.issue_number }}
```

---

## Step 6 — End-to-end test

1. Open a test issue with a simple, precise task
2. Add `claude-plan` label → wait ~60s → verify plan comment appears
3. Read the plan, confirm it looks correct
4. Reply `approved` → wait ~2min → verify:
   - Branch `feature/{number}-{slug}` was created
   - PR was opened targeting main
   - PR content matches the approved plan

---

## Notes on Phase 2 reading Phase 1 plan

The `gh issue view --json comments --jq` command fetches all issue comments and finds
the last one starting with `## Implementation Plan`. This is why Phase 1's prompt instructs
Claude to start its comment with exactly that heading.

If Phase 1 was never run (no plan comment exists), `$PLAN` will be empty and Phase 2
will fall back to the raw issue body — still functional but without the pre-approved plan.
