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
log_lines=100

if [[ "$environment" != "dev" ]]; then
  echo "Only the dev environment is enabled by this script." >&2
  exit 2
fi

shift
while (($# > 0)); do
  case "$1" in
    --logs)
      [[ $# -ge 2 && "$2" =~ ^[0-9]+$ && "$2" -ge 1 && "$2" -le 500 ]] || {
        echo "--logs must be an integer between 1 and 500." >&2
        exit 2
      }
      log_lines="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

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
export IMAGE_DIGEST="$(read_env_digest "$env_file")"
export APP_ENV_FILE="$env_file"
export CLOUDFLARE_TUNNEL_TOKEN_FILE="/etc/furfriend/dev.cloudflare-tunnel-token"
compose_args=(--project-name "$project" --env-file "$env_file" -f "$compose_file" -f "$dev_file")

printf 'configured_digest=%s\n' "$IMAGE_DIGEST"
"${compose[@]}" "${compose_args[@]}" ps
for service in app worker; do
  container_id="$("${compose[@]}" "${compose_args[@]}" ps -q "$service")"
  if [[ -n "$container_id" ]]; then
    docker inspect --format '{{.Name}} image={{.Config.Image}} state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id"
  else
    printf '%s state=missing\n' "$service"
  fi
done
"${compose[@]}" "${compose_args[@]}" logs --no-color --tail "$log_lines" app worker cloudflared
