#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPOSITORY_ROOT/docker/docker-compose.yml"
CONNECTOR_FILE="$REPOSITORY_ROOT/docker/debezium/register-connector-postgres.json"

"$REPOSITORY_ROOT/scripts/kafka-recover-stale-broker.sh" "$COMPOSE_FILE"
docker compose -f "$COMPOSE_FILE" up -d

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

wait_container_success dynamodb-migrations
wait_container_success minio-seed

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

wait_http "Debezium Connect" "http://localhost:8083/connectors"
wait_http "Selfcare mock" "http://localhost:8006/health"

connector_status="$(curl --silent --output /dev/null --write-out '%{http_code}' \
  "http://localhost:8083/connectors/event-connector")"
if [[ "$connector_status" == "404" ]]; then
  curl --fail --silent --show-error \
    --header "Accept: application/json" \
    --header "Content-Type: application/json" \
    --data "@$CONNECTOR_FILE" \
    "http://localhost:8083/connectors" >/dev/null
fi

topics=(
  application-audit
  email-dispatch.emails
  event-store.agreement.events
  event-store.attribute.events
  event-store.authorization.events
  event-store.catalog.events
  event-store.delegation.events
  event-store.eservice_template.events
  event-store.notification_config.events
  event-store.purpose.events
  event-store.purpose_template.events
  event-store.tenant.events
)

for topic in "${topics[@]}"; do
  docker compose -f "$COMPOSE_FILE" exec -T kafka \
    /kafka/bin/kafka-topics.sh \
    --bootstrap-server kafka:29092 \
    --create --if-not-exists --partitions 3 --replication-factor 1 \
    --topic "$topic" >/dev/null
done

echo "Local infrastructure is ready"
