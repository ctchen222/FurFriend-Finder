#!/bin/bash
# =============================================================================
# minion.sh — Local AI-assisted development automation script
# Inspired by Stripe Minions (https://blog.bytebytego.com/p/how-stripes-minions-ship-1300-prs)
#
# Usage:
#   ./scripts/minion.sh "Add Infinity distance test for empty found_place in animalLost.service.test.ts"
#
# Options:
#   MODEL=claude-haiku-4-5-20251001 ./scripts/minion.sh "task"  # budget mode
#   DRY_RUN=1 ./scripts/minion.sh "task"                        # print plan only
#   SKIP_PLAN=1 ./scripts/minion.sh "task"                      # skip plan approval (for scripting)
# =============================================================================
set -euo pipefail

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
TASK="${1:-}"
MODEL="${MODEL:-claude-sonnet-4-6}"
MAX_RETRIES=2
BRANCH="minion/$(date +%Y%m%d-%H%M%S)"
DRY_RUN="${DRY_RUN:-0}"
SKIP_PLAN="${SKIP_PLAN:-0}"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[MINION]${NC} $1"; }
log_success() { echo -e "${GREEN}[MINION]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[MINION]${NC} $1"; }
log_error()   { echo -e "${RED}[MINION]${NC} $1"; }
log_plan()    { echo -e "${CYAN}[PLAN]${NC} $1"; }

# ──────────────────────────────────────────────
# Step 0: Pre-flight checks
# ──────────────────────────────────────────────

# Task description is required
if [ -z "$TASK" ]; then
  log_error "Task description is required."
  echo "Usage: ./scripts/minion.sh \"task description\""
  exit 1
fi

# Task description length check (too short = likely too vague)
if [ ${#TASK} -lt 30 ]; then
  log_error "Task description too short (${#TASK} chars, minimum 30)."
  log_warn "Include the target file path and expected behavior, e.g.:"
  echo "  Add Infinity distance test for empty found_place in src/__test__/unit/service/animalLost.service.test.ts"
  exit 1
fi

# Check claude CLI is available
if ! command -v claude &> /dev/null; then
  log_error "claude CLI not found. Please ensure Claude Code is installed."
  exit 1
fi

# Check gh CLI is available (needed for PR creation)
if ! command -v gh &> /dev/null; then
  log_warn "gh CLI not found. PR creation step will be skipped."
  log_warn "Install with: brew install gh && gh auth login"
  GH_AVAILABLE=0
else
  GH_AVAILABLE=1
fi

# Check we are inside a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  log_error "Not inside a git repository."
  exit 1
fi

# ──────────────────────────────────────────────
# Step 1: Agentic — Claude outputs plan (no file changes)
# ──────────────────────────────────────────────
log_info "Task   : $TASK"
log_info "Model  : $MODEL"
log_info "Branch : $BRANCH"

if [ "$DRY_RUN" = "1" ]; then
  log_warn "[DRY RUN] Skipping plan generation."
elif [ "$SKIP_PLAN" = "1" ]; then
  log_warn "[SKIP_PLAN] Skipping plan approval step."
else
  echo ""
  log_plan "────────────────────────────────────────────"
  log_plan "Generating implementation plan (read-only)..."
  log_plan "────────────────────────────────────────────"
  echo ""

  claude --print \
    --model "$MODEL" \
    --max-turns 2 \
    --dangerously-skip-permissions \
    "Analyze this task and output ONLY a numbered implementation plan. Do NOT make any file changes.
List:
1. Files you need to READ to understand context
2. Files you will MODIFY and what specific changes
3. Estimated line count change
4. Any risks or edge cases

Task: $TASK"

  echo ""
  log_plan "────────────────────────────────────────────"
  echo ""
  read -r -p "$(echo -e "${CYAN}[PLAN]${NC} Proceed with implementation? (y/N) ")" CONFIRM
  echo ""

  if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    log_warn "Aborted by user. No branch created, no changes made."
    exit 0
  fi
fi

# ──────────────────────────────────────────────
# Step 2: Deterministic — create isolated branch
# ──────────────────────────────────────────────
if [ "$DRY_RUN" = "1" ]; then
  log_warn "[DRY RUN] Skipping branch creation."
else
  git checkout -b "$BRANCH"
fi

# ──────────────────────────────────────────────
# Step 3: Agentic — Claude executes the task
# ──────────────────────────────────────────────
log_info "Claude is working on the task..."

if [ "$DRY_RUN" = "1" ]; then
  log_warn "[DRY RUN] Skipping claude execution."
else
  claude --print \
    --model "$MODEL" \
    --max-turns 5 \
    --dangerously-skip-permissions \
    "$TASK"
fi

# ──────────────────────────────────────────────
# Step 4: Deterministic — build check
# ──────────────────────────────────────────────
log_info "Running build check..."

if [ "$DRY_RUN" = "1" ]; then
  log_warn "[DRY RUN] Skipping build."
else
  if ! npm run build; then
    log_error "Build failed. Human intervention required."
    git checkout main
    git branch -D "$BRANCH"
    exit 1
  fi
fi

# ──────────────────────────────────────────────
# Step 5: Feedback loop — max MAX_RETRIES attempts
# ──────────────────────────────────────────────
RETRIES=0
TEST_PASSED=0

while [ $RETRIES -le $MAX_RETRIES ]; do
  log_info "Running tests (attempt $((RETRIES + 1)) of $((MAX_RETRIES + 1)))..."

  if [ "$DRY_RUN" = "1" ]; then
    log_warn "[DRY RUN] Assuming tests pass."
    TEST_PASSED=1
    break
  fi

  if npm test; then
    log_success "All tests passed!"
    TEST_PASSED=1
    break
  fi

  RETRIES=$((RETRIES + 1))

  if [ $RETRIES -le $MAX_RETRIES ]; then
    log_warn "Tests failed. Claude attempting fix (retry $RETRIES of $MAX_RETRIES)..."
    claude --print \
      --model "$MODEL" \
      --max-turns 3 \
      --dangerously-skip-permissions \
      "Fix the failing tests shown above. Only fix the test errors — do not change business logic or add unrelated features."
  fi
done

# ──────────────────────────────────────────────
# Step 6: Outcome
# ──────────────────────────────────────────────
if [ "$TEST_PASSED" != "1" ]; then
  log_error "Exceeded max retries ($MAX_RETRIES). Human intervention required."
  log_warn "Diagnosis hints:"
  log_warn "  1. Task description may be too vague — include the target file path."
  log_warn "  2. Task may span more than 3 files — split into smaller tasks."
  log_warn "  3. Try Sonnet instead: MODEL=claude-sonnet-4-6 ./scripts/minion.sh \"...\""
  if [ "$DRY_RUN" != "1" ]; then
    git checkout main
    git branch -D "$BRANCH"
    log_info "Cleaned up branch $BRANCH."
  fi
  exit 1
fi

# ──────────────────────────────────────────────
# Step 7: Deterministic — commit + open PR
# ──────────────────────────────────────────────
if [ "$DRY_RUN" != "1" ]; then
  log_info "Committing changes..."

  if git diff --quiet && git diff --staged --quiet; then
    log_warn "No file changes detected. Claude may not have modified anything."
    git checkout main
    git branch -D "$BRANCH"
    exit 0
  fi

  git add -A
  git commit -m "$(cat <<EOF
feat: ${TASK:0:72}

Auto-generated by Minion
Model: $MODEL
Retries: $RETRIES
EOF
)"

  git push -u origin "$BRANCH"

  if [ "$GH_AVAILABLE" = "1" ]; then
    log_info "Creating pull request..."
    PR_URL=$(gh pr create \
      --title "$TASK" \
      --body "$(cat <<EOF
## Task

$TASK

## Auto-generated Info

- **Model**: $MODEL
- **Retries**: $RETRIES / $MAX_RETRIES
- **Generated at**: $(date '+%Y-%m-%d %H:%M:%S')

## Review Checklist

- [ ] Changes match the task description
- [ ] No unrelated code was modified
- [ ] Test logic is correct (not just forced to pass)
EOF
)" \
      --base main)
    log_success "Done! PR: $PR_URL"
  else
    log_success "Changes pushed to $BRANCH. Please create a PR manually."
  fi

  git checkout main
fi

log_success "Minion task complete."
