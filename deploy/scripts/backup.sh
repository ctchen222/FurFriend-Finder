#!/usr/bin/env bash
set -Eeuo pipefail

readonly project="furfriend-dev"
readonly app_root="/opt/furfriend/dev"
readonly env_file="/etc/furfriend/dev.env"
readonly compose_file="$app_root/deploy/compose/compose.yaml"
readonly dev_file="$app_root/deploy/compose/compose.dev.yaml"
readonly backup_dir="${BACKUP_DIR:-/var/backups/furfriend/dev}"

if docker compose version >/dev/null 2>&1; then
  compose=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  compose=(docker-compose)
else
  echo "Docker Compose is not installed." >&2
  exit 1
fi

mkdir -p "$backup_dir"
cd "$app_root"
export APP_ENV_FILE="$env_file"
export CLOUDFLARE_TUNNEL_TOKEN_FILE="/etc/furfriend/dev.cloudflare-tunnel-token"
compose_args=(--project-name "$project" --env-file "$env_file" -f "$compose_file" -f "$dev_file")
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_path="$backup_dir/furfriend-dev-$timestamp.sql.gz"

"${compose[@]}" "${compose_args[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$backup_path"
chmod 600 "$backup_path"
echo "$backup_path"
