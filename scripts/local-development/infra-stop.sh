#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPOSITORY_ROOT/docker/docker-compose.yml"

# Kafka must close its ZooKeeper session before ZooKeeper is stopped. Stopping
# every service in parallel can leave the broker's ephemeral node behind and
# make an immediate local restart fail with NodeExists.
docker compose -f "$COMPOSE_FILE" stop connect kafka
docker compose -f "$COMPOSE_FILE" stop
