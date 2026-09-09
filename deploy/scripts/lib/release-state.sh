#!/usr/bin/env bash

validate_digest() {
  [[ "${1:-}" =~ ^sha256:[0-9a-f]{64}$ ]]
}

read_env_digest() {
  local file="$1"
  local value

  value="$(sed -n 's/^IMAGE_DIGEST=//p' "$file")"
  [[ "$(grep -c '^IMAGE_DIGEST=' "$file")" == "1" ]]
  validate_digest "$value"
  printf '%s\n' "$value"
}

persist_env_digest() {
  local file="$1"
  local digest="$2"
  local tmp

  validate_digest "$digest"
  tmp="$(mktemp "${file}.tmp.XXXXXX")"
  trap 'rm -f "$tmp"' RETURN

  awk -v digest="$digest" '
    BEGIN { replaced = 0 }
    /^IMAGE_DIGEST=/ { print "IMAGE_DIGEST=" digest; replaced++; next }
    { print }
    END { if (replaced != 1) exit 42 }
  ' "$file" > "$tmp"
  if chown --reference="$file" "$tmp" 2>/dev/null; then
    chmod --reference="$file" "$tmp"
  else
    chown "$(stat -f '%u:%g' "$file")" "$tmp"
    chmod "$(stat -f '%Lp' "$file")" "$tmp"
  fi
  mv -f "$tmp" "$file"

  trap - RETURN
}
