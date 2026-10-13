#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="${INTEROP_BE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
STATE_ROOT="$REPOSITORY_ROOT/.local-development/dashboard"
OVERRIDE="$STATE_ROOT/compose.yml"
COMPOSE_FILE="$REPOSITORY_ROOT/docker/docker-compose.yml"
COMMAND="${1:-start}"
shift || true
STARTUP_PRESET="${DASHBOARD_AUTOSTART_PRESET:-}"
while (( $# )); do
  case "$1" in
    --preset) STARTUP_PRESET="${2:?Missing startup preset ID}"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 1 ;;
  esac
done

json_string() {
  local value="$1"
  if [[ "$value" == *$'\n'* || "$value" == *$'\r'* || "$value" == *$'\t'* ]]; then
    echo "Workspace paths cannot contain control characters" >&2
    exit 1
  fi
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  printf '"%s"' "$value"
}

prepare() {
  REPOSITORY_ROOT="$(cd "$REPOSITORY_ROOT" && pwd -P)"
  mkdir -p "$STATE_ROOT"
  local volume_names=(dashboard-be-modules dashboard-pnpm-store)
  {
    printf '{"services":{"dashboard":{"working_dir":'
    json_string "$REPOSITORY_ROOT"
    printf ',"environment":{"INTEROP_BE_ROOT":'
    json_string "$REPOSITORY_ROOT"
    if [[ -n "$STARTUP_PRESET" ]]; then
      printf ',"DASHBOARD_AUTOSTART_PRESET":'
      json_string "$STARTUP_PRESET"
    fi
    printf ',"DASHBOARD_AUTOSTART":"%s","INTEROP_DASHBOARD_RUNTIME":"true","LOCAL_UID":"%s","LOCAL_GID":"%s"},' \
      "${DASHBOARD_AUTOSTART:-true}" "$(id -u)" "$(id -g)"
    printf '"volumes":[{"type":"bind","source":'
    json_string "$REPOSITORY_ROOT"
    printf ',"target":'
    json_string "$REPOSITORY_ROOT"
    printf '},{"type":"volume","source":"dashboard-be-modules","target":'
    json_string "$REPOSITORY_ROOT/node_modules"
    printf ',"volume":{"nocopy":true}},{"type":"volume","source":"dashboard-pnpm-store","target":"/home/node/.local/share/pnpm","volume":{"nocopy":true}}'
    for manifest in "$REPOSITORY_ROOT"/packages/*/package.json; do
      [[ -f "$manifest" ]] || continue
      local directory="${manifest%/package.json}"
      local name="dashboard-be-${directory##*/}-modules"
      volume_names+=("$name")
      printf ',{"type":"volume","source":"%s","target":' "$name"
      json_string "$directory/node_modules"
      printf ',"volume":{"nocopy":true}}'
    done
    printf ']'
    # Publish development APIs on loopback; catalog uses 13000 because the FE
    # public origin occupies 3000 in its separate container.
    printf ',"ports":[{"target":3000,"published":"13000","host_ip":"127.0.0.1"}'
    for port in 3100 3200 3300 3400 3500 3600 3700 3800 3900 4000 4100 4200 4300 4400 4600 4700; do
      printf ',{"target":%s,"published":"%s","host_ip":"127.0.0.1"}' "$port" "$port"
    done
    printf ']}},"volumes":{'
    local separator=""
    for name in "${volume_names[@]}"; do
      printf '%s"%s":{}' "$separator" "$name"
      separator=,
    done
    printf '}}\n'
  } > "$OVERRIDE.tmp"
  mv "$OVERRIDE.tmp" "$OVERRIDE"
  echo "Prepared dashboard runtime: $OVERRIDE"
}

compose() {
  [[ -f "$OVERRIDE" ]] || { echo "Run $0 prepare first" >&2; exit 1; }
  docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE" --profile dashboard "$@"
}

case "$COMMAND" in
  prepare) prepare ;;
  start) prepare; compose up -d --build dashboard; echo 'Dashboard: http://localhost:8076' ;;
  status) compose ps dashboard ;;
  logs) compose logs --follow dashboard ;;
  stop) compose stop dashboard ;;
  *) echo "Usage: $0 {prepare|start|status|logs|stop} [--preset ID]" >&2; exit 1 ;;
esac
