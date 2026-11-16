#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="$1"

# ZooKeeper can retain Kafka's ephemeral broker node briefly after an unclean
# Docker shutdown. Start it first and remove that node only when no Kafka
# process is currently running; the Kafka data volume and topics are untouched.
docker compose -f "$COMPOSE_FILE" up -d --wait zookeeper

kafka_container_id="$(docker compose -f "$COMPOSE_FILE" ps -aq kafka)"
if [[ -n "$kafka_container_id" ]] \
  && [[ "$(docker inspect --format '{{.State.Running}}' "$kafka_container_id")" == "true" ]]; then
  exit 0
fi

docker compose -f "$COMPOSE_FILE" exec -T zookeeper \
  /zookeeper/bin/zkCli.sh delete /brokers/ids/1 >/dev/null 2>&1 || true
