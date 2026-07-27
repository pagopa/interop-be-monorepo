#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
COMPOSE_FILE="$REPOSITORY_ROOT/docker/docker-compose.yml"
LOCAL_SCRIPTS="$REPOSITORY_ROOT/scripts/local-development"

"$LOCAL_SCRIPTS/kafka-recover-stale-broker.sh" "$COMPOSE_FILE"

(
  cd "$REPOSITORY_ROOT"
  pnpm infra:start
)

"$LOCAL_SCRIPTS/wait-infrastructure.sh" "$COMPOSE_FILE"
"$LOCAL_SCRIPTS/kafka-create-topics.sh" "$COMPOSE_FILE"

echo "Frontend local infrastructure is ready"
