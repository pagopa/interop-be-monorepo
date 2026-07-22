#!/usr/bin/env bash
set -euo pipefail

# Kafka must close its ZooKeeper session before ZooKeeper is stopped. Stopping
# every service in parallel can leave the broker's ephemeral node behind and
# make an immediate local restart fail with NodeExists.
docker compose -f docker/docker-compose.yml stop connect kafka
docker compose -f docker/docker-compose.yml stop
