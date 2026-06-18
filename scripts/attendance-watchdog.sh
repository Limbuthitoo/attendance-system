#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="/home/ubuntu/attendance/attendance-system"
DOCKER="${DOCKER:-/usr/bin/docker}"

cd "$PROJECT_DIR"

# Reconcile the compose stack. This starts stopped services after reboot/crash
# without recreating healthy containers.
"$DOCKER" compose up -d --remove-orphans

unhealthy_containers="$("$DOCKER" ps \
  --filter "name=attendance-system-" \
  --filter "health=unhealthy" \
  --format "{{.Names}}")"

if [ -n "$unhealthy_containers" ]; then
  echo "$unhealthy_containers" | while IFS= read -r container; do
    [ -z "$container" ] && continue
    echo "Restarting unhealthy container: $container"
    "$DOCKER" restart "$container"
  done
fi
