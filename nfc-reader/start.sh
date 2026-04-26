#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_BINARY="$(command -v node || true)"

if [[ -z "$NODE_BINARY" ]]; then
  echo "Node.js is not installed or not in PATH."
  exit 1
fi

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "Missing $SCRIPT_DIR/.env. Copy .env.example first and configure it."
  exit 1
fi

cd "$SCRIPT_DIR"
exec "$NODE_BINARY" index.js