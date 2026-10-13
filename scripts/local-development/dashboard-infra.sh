#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="${INTEROP_BE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
COMPOSE_FILE="$REPOSITORY_ROOT/docker/docker-compose.yml"
LOCAL_SCRIPTS="$REPOSITORY_ROOT/scripts/local-development"
compose() { docker compose -f "$COMPOSE_FILE" "$@"; }

# Explicit targets protect the runtime, even when it belongs to this project.
services=()
configured_services="$(compose config --services)"
while IFS= read -r service; do
  [[ -z "$service" || "$service" == dashboard ]] || services+=("$service")
done <<< "$configured_services"
(( ${#services[@]} )) || { echo 'No infrastructure services configured' >&2; exit 1; }

stop_infrastructure() {
  # Close Kafka's ZooKeeper session before stopping ZooKeeper itself.
  if [[ " $configured_services " == *connect* && " $configured_services " == *kafka* ]]; then
    compose stop connect kafka
  fi
  compose stop "${services[@]}"
}

case "${1:-}" in
  recover) bash "$LOCAL_SCRIPTS/kafka-recover-stale-broker.sh" "$COMPOSE_FILE" ;;
  start) compose up -d "${services[@]}" ;;
  wait) bash "$LOCAL_SCRIPTS/wait-infrastructure.sh" "$COMPOSE_FILE" ;;
  topics) bash "$LOCAL_SCRIPTS/kafka-create-topics.sh" "$COMPOSE_FILE" ;;
  connector)
    url="http://localhost:8083/connectors/"
    for ((attempt=0; attempt<180; attempt++)); do
      response="$(curl --silent --connect-timeout 2 --max-time 5 --output /dev/null \
        --write-out '%{http_code}' -X POST -H 'Content-Type: application/json' \
        --data-binary "@$REPOSITORY_ROOT/register-connector-postgres.json" "$url" || true)"
      if [[ "$response" == 201 || "$response" == 409 ]]; then
        echo 'Debezium connector is ready'
        exit 0
      fi
      sleep 1
    done
    echo 'Timed out registering the local Debezium connector' >&2
    exit 1
    ;;
  stop) stop_infrastructure ;;
  reset)
    # Only volumes referenced by infrastructure services are eligible for
    # deletion. Runtime dependencies and personal presets are preserved.
    config="$(compose config --format json)"
    volume_names="$(printf '%s' "$config" | node --input-type=module -e '
      let input = "";
      for await (const chunk of process.stdin) input += chunk;
      const config = JSON.parse(input);
      const selected = new Set(Object.entries(config.services)
        .filter(([name]) => name !== "dashboard")
        .flatMap(([, service]) => service.volumes ?? [])
        .filter(mount => mount.type === "volume")
        .map(mount => config.volumes[mount.source]?.name)
        .filter(Boolean));
      for (const name of selected) console.log(name);
    ')"
    volumes=()
    while IFS= read -r name; do
      [[ -n "$name" ]] || continue
      if docker volume inspect "$name" >/dev/null 2>&1; then volumes+=("$name"); fi
    done <<< "$volume_names"
    stop_infrastructure
    compose rm -f "${services[@]}"
    if (( ${#volumes[@]} )); then
      docker volume rm "${volumes[@]}"
    fi
    rm -f "$REPOSITORY_ROOT/.local-development/state.json" \
      "$REPOSITORY_ROOT/.local-development/frontend-token"
    echo 'Local infrastructure data reset; dashboard configuration preserved'
    ;;
  *) echo "Usage: $0 {recover|start|wait|topics|connector|stop|reset}" >&2; exit 1 ;;
esac
