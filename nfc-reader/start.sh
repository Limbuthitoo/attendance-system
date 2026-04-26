#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BINARY="$(command -v node || true)"
LOG_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/archisys-nfc-reader"
LOG_FILE="$LOG_DIR/reader.log"
RESTART_DELAY_SECONDS="${RESTART_DELAY_SECONDS:-5}"
MAX_RESTART_DELAY_SECONDS="${MAX_RESTART_DELAY_SECONDS:-30}"

if [[ -z "$NODE_BINARY" ]]; then
  echo "Node.js is not installed or not in PATH."
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "Missing $SCRIPT_DIR/.env. Copy .env.example first and configure it."
  exit 1
fi

cd "$SCRIPT_DIR"
mkdir -p "$LOG_DIR"

while true; do
  "$NODE_BINARY" index.js >>"$LOG_FILE" 2>&1
  exit_code=$?

  if [[ $exit_code -eq 0 ]]; then
    exit 0
  fi

  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  message="[$timestamp] nfc-reader exited with code $exit_code; restarting in ${RESTART_DELAY_SECONDS}s"
  echo "$message" >>"$LOG_FILE"

  if [[ -t 1 ]]; then
    echo "$message"
  fi

  sleep "$RESTART_DELAY_SECONDS"

  if (( RESTART_DELAY_SECONDS < MAX_RESTART_DELAY_SECONDS )); then
    RESTART_DELAY_SECONDS=$(( RESTART_DELAY_SECONDS * 2 ))
    if (( RESTART_DELAY_SECONDS > MAX_RESTART_DELAY_SECONDS )); then
      RESTART_DELAY_SECONDS=$MAX_RESTART_DELAY_SECONDS
    fi
  fi
done