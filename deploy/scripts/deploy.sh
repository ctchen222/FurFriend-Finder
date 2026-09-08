#!/usr/bin/env bash
set -Eeuo pipefail

environment="${1:-}"
image_digest="${2:-}"

if [[ "$environment" != "dev" ]]; then
  echo "Only the dev environment is enabled by this script." >&2
  exit 2
fi

if [[ ! "$image_digest" =~ ^sha256:[0-9a-f]{64}$ ]]; then
  echo "Expected an immutable sha256 image digest." >&2
  exit 2
fi

readonly project="furfriend-dev"
readonly app_root="/opt/furfriend/dev"
readonly env_file="/etc/furfriend/dev.env"
readonly compose_file="$app_root/deploy/compose/compose.yaml"
readonly dev_file="$app_root/deploy/compose/compose.dev.yaml"

for required in "$env_file" "$compose_file" "$dev_file"; do
  if [[ ! -r "$required" ]]; then
    echo "Required deployment file is not readable: $required" >&2
    exit 1
  fi
done

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
"${compose[@]}" "${compose_args[@]}" pull postgres mailpit app worker cloudflared
"${compose[@]}" "${compose_args[@]}" up -d postgres mailpit
"${compose[@]}" "${compose_args[@]}" run --rm migrate
"${compose[@]}" "${compose_args[@]}" up -d --wait app worker cloudflared
"${compose[@]}" "${compose_args[@]}" ps
