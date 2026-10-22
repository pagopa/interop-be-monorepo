#!/usr/bin/env bash
set -euo pipefail
REPOSITORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for phase in recover start wait topics connector; do
  bash "$REPOSITORY_ROOT/scripts/local-development/dashboard-infra.sh" "$phase"
done
