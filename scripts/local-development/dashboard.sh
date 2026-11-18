#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd "${INTEROP_BE_ROOT:-$(dirname "${BASH_SOURCE[0]}")/../..}" && pwd -P)"
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

prepare() {
  mkdir -p "$STATE_ROOT"
  local runtime_uid runtime_gid runtime_image temporary mount_source
  if [[ "$(uname -s)" == Darwin ]]; then
    runtime_uid=1000
    runtime_gid=1000
  else
    runtime_uid="$(id -u)"
    runtime_gid="$(id -g)"
  fi

  # Build only the tooling image. No application or infrastructure starts here.
  runtime_image="$(docker compose -f "$COMPOSE_FILE" --profile dashboard config --images dashboard)"
  docker compose -f "$COMPOSE_FILE" --profile dashboard build dashboard
  temporary="$(mktemp "$OVERRIDE.XXXXXX")"
  # Docker --mount uses CSV fields; quote the source to preserve commas/quotes.
  mount_source="${REPOSITORY_ROOT//\"/\"\"}"
  if docker compose -f "$COMPOSE_FILE" --profile dashboard config --format json |
    docker run --rm --pull never --network none --read-only -i \
      --mount "type=bind,\"source=$mount_source\",target=/workspace,readonly" \
      --entrypoint node "$runtime_image" \
      /opt/dashboard-bootstrap/docker/dev-dashboard/generate-compose.mjs \
      --checkout /workspace --source "$REPOSITORY_ROOT" \
      --uid "$runtime_uid" --gid "$runtime_gid" \
      --autostart "${DASHBOARD_AUTOSTART:-true}" --preset "$STARTUP_PRESET" > "$temporary"; then
    mv "$temporary" "$OVERRIDE"
  else
    rm -f "$temporary"
    return 1
  fi
  echo "Prepared dashboard runtime: $OVERRIDE"
}

compose() {
  [[ -f "$OVERRIDE" ]] || { echo "Start the dashboard with $0 start first" >&2; exit 1; }
  docker compose -f "$COMPOSE_FILE" -f "$OVERRIDE" --profile dashboard "$@"
}

case "$COMMAND" in
  prepare) prepare ;;
  start) prepare; compose up -d --no-build dashboard; echo 'Dashboard: http://localhost:8076' ;;
  status) compose ps dashboard ;;
  logs) compose logs --follow dashboard ;;
  stop) compose stop dashboard ;;
  *) echo "Usage: $0 {start|status|logs|stop|prepare} [--preset ID]" >&2; exit 1 ;;
esac
