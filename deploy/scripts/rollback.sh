#!/usr/bin/env bash
set -Eeuo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -r "$script_dir/lib/release-state.sh" ]]; then
  source "$script_dir/lib/release-state.sh"
elif [[ -r /usr/local/lib/furfriend/release-state.sh ]]; then
  source /usr/local/lib/furfriend/release-state.sh
else
  echo "Release-state helper is not installed." >&2
  exit 1
fi

environment="${1:-}"
image_digest="${2:-}"

if [[ "$environment" != "dev" ]]; then
  echo "Only the dev environment is enabled by this script." >&2
  exit 2
fi

if ! validate_digest "$image_digest"; then
  echo "Expected an immutable sha256 image digest." >&2
  exit 2
fi

readonly project="furfriend-dev"
readonly app_root="/opt/furfriend/dev"
readonly env_file="/etc/furfriend/dev.env"
readonly compose_file="$app_root/deploy/compose/compose.yaml"
readonly dev_file="$app_root/deploy/compose/compose.dev.yaml"

install -d -m 755 /run/lock
exec 9>/run/lock/furfriend-dev-deploy.lock
if ! flock -n 9; then
  echo "Another FurFriend dev deployment is active." >&2
  exit 75
fi

current_digest="$(read_env_digest "$env_file")"

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo "Docker Compose is not installed." >&2
  exit 1
fi

cd "$app_root"
export IMAGE_REPOSITORY="${IMAGE_REPOSITORY:-ghcr.io/ctchen222/furfriend-finder}"
export IMAGE_DIGEST="$image_digest"
export APP_ENV_FILE="$env_file"
export CLOUDFLARE_TUNNEL_TOKEN_FILE="/etc/furfriend/dev.cloudflare-tunnel-token"
compose_args=(--project-name "$project" --env-file "$env_file" -f "$compose_file" -f "$dev_file")

"${compose[@]}" "${compose_args[@]}" config --quiet
"${compose[@]}" "${compose_args[@]}" pull app worker cloudflared
"${compose[@]}" "${compose_args[@]}" up -d --wait app worker cloudflared
"${compose[@]}" "${compose_args[@]}" ps

expected_image="${IMAGE_REPOSITORY}@${image_digest}"
for service in app worker; do
  container_id="$("${compose[@]}" "${compose_args[@]}" ps -q "$service")"
  [[ -n "$container_id" ]]
  [[ "$(docker inspect --format '{{.Config.Image}}' "$container_id")" == "$expected_image" ]]
done

install -d -m 700 /var/lib/furfriend/dev
printf '%s\n' "$current_digest" > /var/lib/furfriend/dev/previous-digest
chmod 600 /var/lib/furfriend/dev/previous-digest
persist_env_digest "$env_file" "$image_digest"
