#!/usr/bin/env bash
set -euo pipefail

if [[ "${1:-}" != --user ]]; then
  : "${INTEROP_BE_ROOT:?Use scripts/local-development/dashboard.sh prepare to configure the checkout}"
  uid="${LOCAL_UID:-1000}"
  gid="${LOCAL_GID:-1000}"
  [[ "$uid" =~ ^[0-9]+$ && "$gid" =~ ^[0-9]+$ && "$uid" != 0 ]] || {
    echo 'Run the dashboard from a non-root development checkout' >&2; exit 1;
  }
  if [[ "$(id -g node)" != "$gid" ]]; then
    groupmod -o -g "$gid" node
  fi
  if [[ "$(id -u node)" != "$uid" ]]; then
    usermod -o -u "$uid" node
  fi
  socket_gid="$(stat -c '%g' /var/run/docker.sock)"
  socket_group="$(getent group "$socket_gid" | cut -d: -f1)"
  if [[ -z "$socket_group" ]]; then
    socket_group=dashboard-docker
    groupadd -g "$socket_gid" "$socket_group"
  fi
  usermod -aG "$socket_group" node

  dependency_paths=("$INTEROP_BE_ROOT/node_modules" /home/node/.local/share/pnpm)
  for manifest in "$INTEROP_BE_ROOT"/packages/*/package.json; do
    [[ -f "$manifest" ]] || continue
    dependency_paths+=("${manifest%/package.json}/node_modules")
  done
  for directory in "${dependency_paths[@]}"; do
    mountpoint -q "$directory" || {
      echo "Missing dependency volume: $directory. Regenerate the Compose override." >&2; exit 1;
    }
    if [[ "$(stat -c '%u:%g' "$directory")" != "$uid:$gid" ]]; then
      chown -R "$uid:$gid" "$directory"
    fi
  done
  exec gosu node /usr/local/bin/dashboard-entrypoint --user
fi

cd "$INTEROP_BE_ROOT"
mkdir -p .local-development/dashboard/logs
log="$INTEROP_BE_ROOT/.local-development/dashboard/logs/bootstrap.log"
exec > >(tee -a "$log") 2>&1

pids=()
cleanup() {
  if (( ${#pids[@]} )); then kill "${pids[@]}" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 0' INT TERM

# Service .env files and the local seed CLI deliberately address loopback.
# Proxy only infrastructure ports; application processes share this container.
for port in 4500 4566 6001 6002 6003 6004 6006 6007 6008 6009 6379 8005 8006 8083 8085 9000 9092 9324; do
  socat "TCP4-LISTEN:$port,bind=127.0.0.1,fork,reuseaddr" "TCP4:host.docker.internal:$port" &
  pids+=("$!")
done
sleep 0.2
for pid in "${pids[@]}"; do
  kill -0 "$pid" || { echo 'Infrastructure loopback forwarding failed' >&2; exit 1; }
done

echo 'Installing backend workspace dependencies'
CI=true pnpm install --frozen-lockfile
echo 'Building the dashboard'
pnpm --filter pagopa-interop-dev-dashboard-contracts generate-model
pnpm --filter pagopa-interop-dev-dashboard-contracts build
pnpm --filter pagopa-interop-dev-dashboard-api build
pnpm --filter pagopa-interop-dev-dashboard-ui build
echo 'Starting dashboard API'
node packages/dev-dashboard-api/dist/index.js &
api_pid="$!"
pids+=("$api_pid")
wait "$api_pid"
