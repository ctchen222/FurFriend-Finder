#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
tmpdir="$(mktemp -d "${TMPDIR:-/tmp}/minion-workflow-test.XXXXXX")"

echo "Using temp test workspace: $tmpdir"

fake_bin="${tmpdir}/bin"
mkdir -p "$fake_bin"

cat > "${fake_bin}/gh" <<'FAKE_GH'
#!/usr/bin/env bash
set -euo pipefail

state_file="${MINION_FAKE_GH_STATE:?MINION_FAKE_GH_STATE is required}"

if [ "$1" = "pr" ] && [ "$2" = "list" ]; then
  if [ -f "$state_file" ]; then
    cat "$state_file"
  else
    printf '[]'
  fi
  exit 0
fi

if [ "$1" = "pr" ] && [ "$2" = "create" ]; then
  base=""
  head=""
  body=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --base)
        base="$2"
        shift 2
        ;;
      --head)
        head="$2"
        shift 2
        ;;
      --body)
        body="$2"
        shift 2
        ;;
      *)
        shift
        ;;
    esac
  done

  url="https://github.com/ctchen222/FurFriend-Finder/pull/999"
  printf '[{"number":999,"url":"%s","body":"%s","baseRefName":"%s","headRefName":"%s"}]' \
    "$url" "$body" "$base" "$head" > "$state_file"
  printf '%s\n' "$url"
  exit 0
fi

echo "Unexpected fake gh call: $*" >&2
exit 1
FAKE_GH

chmod +x "${fake_bin}/gh"

setup_repo() {
  local name="$1"
  local origin="${tmpdir}/${name}-origin.git"
  local repo="${tmpdir}/${name}-repo"

  git init --bare "$origin" >/dev/null
  git init "$repo" >/dev/null
  git -C "$repo" config user.name "Test User"
  git -C "$repo" config user.email "test@example.com"
  printf 'base\n' > "${repo}/README.md"
  git -C "$repo" add README.md
  git -C "$repo" commit -m "initial" >/dev/null
  git -C "$repo" branch -M dev
  git -C "$repo" remote add origin "$origin"
  git -C "$repo" push -u origin dev >/dev/null 2>&1

  printf '%s\n' "$repo"
}

assert_contains() {
  local file="$1"
  local expected="$2"

  if ! grep -Fq "$expected" "$file"; then
    echo "Expected to find '$expected' in $file" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

metadata_output="${tmpdir}/metadata-output"
DATE=260522 \
ISSUE_NUMBER=35 \
ISSUE_TITLE="Improve spacing on auth forms" \
GITHUB_OUTPUT="$metadata_output" \
  "${script_dir}/minion-issue-metadata.sh" >/dev/null
assert_contains "$metadata_output" "branch_name=fix/260522-improve-spacing-on-auth-forms-35"

no_change_repo="$(setup_repo no-change)"
no_change_log="${tmpdir}/no-change.log"
set +e
(
  cd "$no_change_repo"
  GITHUB_REPOSITORY="ctchen222/FurFriend-Finder" \
  BRANCH_NAME="fix/260522-no-change-35" \
  ISSUE_NUMBER=35 \
  PR_TITLE="No change" \
    "${script_dir}/minion-finalize-pr.sh"
) >"$no_change_log" 2>&1
no_change_status=$?
set -e
if [ "$no_change_status" -eq 0 ]; then
  echo "Expected no-change finalize to fail" >&2
  exit 1
fi
assert_contains "$no_change_log" "Minion produced no file changes or commits"

diff_repo="$(setup_repo diff-change)"
diff_state="${tmpdir}/diff-gh-state.json"
diff_output="${tmpdir}/diff-output"
(
  cd "$diff_repo"
  printf 'change\n' > src-public-css-style.css
  PATH="${fake_bin}:$PATH" \
  MINION_FAKE_GH_STATE="$diff_state" \
  GITHUB_OUTPUT="$diff_output" \
  GITHUB_REPOSITORY="ctchen222/FurFriend-Finder" \
  BRANCH_NAME="fix/260522-diff-change-35" \
  ISSUE_NUMBER=35 \
  PR_TITLE="Diff change" \
    "${script_dir}/minion-finalize-pr.sh"
) >"${tmpdir}/diff-change.log" 2>&1
assert_contains "$diff_output" "url=https://github.com/ctchen222/FurFriend-Finder/pull/999"
git --git-dir="${tmpdir}/diff-change-origin.git" rev-parse refs/heads/fix/260522-diff-change-35 >/dev/null

existing_repo="$(setup_repo existing-commit)"
existing_state="${tmpdir}/existing-gh-state.json"
(
  cd "$existing_repo"
  git switch -c minion/existing >/dev/null
  printf 'already committed\n' > committed-change.txt
  git add committed-change.txt
  git commit -m "manual implementation" >/dev/null
  PATH="${fake_bin}:$PATH" \
  MINION_FAKE_GH_STATE="$existing_state" \
  GITHUB_REPOSITORY="ctchen222/FurFriend-Finder" \
  BRANCH_NAME="fix/260522-existing-commit-35" \
  ISSUE_NUMBER=35 \
  PR_TITLE="Existing commit" \
    "${script_dir}/minion-finalize-pr.sh"
) >"${tmpdir}/existing-commit.log" 2>&1
git --git-dir="${tmpdir}/existing-commit-origin.git" rev-parse refs/heads/fix/260522-existing-commit-35 >/dev/null

echo "Minion workflow smoke tests passed."
