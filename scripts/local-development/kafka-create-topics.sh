#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="$1"

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
