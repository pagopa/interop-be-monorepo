#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$REPOSITORY_ROOT/docker/docker-compose.yml"

docker compose -f "$COMPOSE_FILE" down --volumes --remove-orphans
rm -f "$REPOSITORY_ROOT/.local-development/state.json"

echo "Local infrastructure volumes and generated seed state were removed"
