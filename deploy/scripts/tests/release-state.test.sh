#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$script_dir/lib/release-state.sh"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
env_file="$tmp_dir/dev.env"
old="sha256:$(printf 'a%.0s' {1..64})"
new="sha256:$(printf 'b%.0s' {1..64})"

printf 'IMAGE_REPOSITORY=ghcr.io/ctchen222/furfriend-finder\nIMAGE_DIGEST=%s\nNODE_ENV=production\n' "$old" > "$env_file"
chmod 600 "$env_file"

validate_digest "$new"
! validate_digest latest
! validate_digest "sha256:$(printf 'A%.0s' {1..64})"
[[ "$(read_env_digest "$env_file")" == "$old" ]]
persist_env_digest "$env_file" "$new"
[[ "$(read_env_digest "$env_file")" == "$new" ]]
permissions="$(stat -c '%a' "$env_file" 2>/dev/null || stat -f '%Lp' "$env_file")"
[[ "$permissions" == "600" ]]
grep -qx 'NODE_ENV=production' "$env_file"
