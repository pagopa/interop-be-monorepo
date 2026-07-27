#!/usr/bin/env bash
set -euo pipefail

REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_ROOT="$REPOSITORY_ROOT/.local-development"
PID_FILE="$RUNTIME_ROOT/frontend-full.pids"
START_DELAY_SECONDS="${INTEROP_SERVICE_START_DELAY_SECONDS:-2}"
BACKEND_WATCH="${INTEROP_BACKEND_WATCH:-false}"
PIDS=()

SERVICES=(
  pagopa-interop-tenant-process
  pagopa-interop-tenant-readmodel-writer-sql
  pagopa-interop-catalog-process
  pagopa-interop-catalog-readmodel-writer-sql
  pagopa-interop-catalog-platformstate-writer
  pagopa-interop-backend-for-frontend
  pagopa-interop-attribute-registry-process
  pagopa-interop-attribute-registry-readmodel-writer-sql
  pagopa-interop-agreement-process
  pagopa-interop-agreement-readmodel-writer-sql
  pagopa-interop-agreement-platformstate-writer
  pagopa-interop-authorization-process
  pagopa-interop-authorization-platformstate-writer
  pagopa-interop-client-readmodel-writer-sql
  pagopa-interop-key-readmodel-writer-sql
  pagopa-interop-producer-key-readmodel-writer-sql
  pagopa-interop-producer-keychain-readmodel-writer-sql
  pagopa-interop-producer-keychain-platformstate-writer
  pagopa-interop-delegation-process
  pagopa-interop-delegation-readmodel-writer-sql
  pagopa-interop-eservice-template-process
  pagopa-interop-eservice-template-readmodel-writer-sql
  pagopa-interop-purpose-process
  pagopa-interop-purpose-readmodel-writer-sql
  pagopa-interop-purpose-platformstate-writer
  pagopa-interop-purpose-template-process
  pagopa-interop-purpose-template-readmodel-writer-sql
  pagopa-interop-notification-config-process
  pagopa-interop-notification-config-readmodel-writer-sql
  pagopa-interop-in-app-notification-manager
)

stop_children() {
  if (( ${#PIDS[@]} > 0 )); then
    kill "${PIDS[@]}" 2>/dev/null || true
    wait "${PIDS[@]}" 2>/dev/null || true
  fi
  rm -f "$PID_FILE"
}

trap stop_children EXIT
trap 'exit 0' INT TERM

cd "$REPOSITORY_ROOT"
mkdir -p "$RUNTIME_ROOT"
: > "$PID_FILE"

export SELFCARE_V2_URL="${SELFCARE_V2_URL:-http://localhost:8006}"
export SELFCARE_V2_API_KEY="${SELFCARE_V2_API_KEY:-local-selfcare-key}"
export DYNAMO_DB_ENDPOINT="${DYNAMO_DB_ENDPOINT:-http://localhost:8085}"
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=192}"

pnpm local:infra:start

for service in "${SERVICES[@]}"; do
  echo "Starting $service"
  package_directory="$REPOSITORY_ROOT/packages/${service#pagopa-interop-}"
  watch_arguments=()
  if [[ "$BACKEND_WATCH" == "true" ]]; then
    watch_arguments+=(--watch)
  fi
  (
    cd "$package_directory"
    exec "$package_directory/node_modules/.bin/tsx" \
      -r dotenv-flow/config "${watch_arguments[@]}" ./src/index.ts
  ) &
  PIDS+=("$!")
  printf '%s %s\n' "$service" "$!" >> "$PID_FILE"
  sleep "$START_DELAY_SECONDS"
done

wait
