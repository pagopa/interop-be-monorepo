#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="$1"

wait_container_success() {
  local service="$1"
  local container_id
  local exit_code
  container_id="$(docker compose -f "$COMPOSE_FILE" ps -aq "$service")"
  exit_code="$(docker wait "$container_id")"
  if [[ "$exit_code" != "0" ]]; then
    docker compose -f "$COMPOSE_FILE" logs "$service" >&2
    echo "$service initialization failed with exit code $exit_code" >&2
    return 1
  fi
}

wait_http() {
  local name="$1"
  local url="$2"
  local attempts=0
  until curl --fail --silent --output /dev/null "$url"; do
    attempts=$((attempts + 1))
    if (( attempts >= 120 )); then
      echo "Timed out waiting for $name at $url" >&2
      return 1
    fi
    sleep 1
  done
}

wait_container_success dynamodb-migrations
wait_container_success minio-seed
wait_http "Selfcare mock" "http://localhost:8006/health"
