#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="archisys-nfc-reader.service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_PATH="$SCRIPT_DIR/archisys-nfc-reader.service.example"
NODE_BINARY="$(command -v node || true)"
CURRENT_USER="$(id -un)"
TEMP_UNIT="$(mktemp)"

cleanup() {
  rm -f "$TEMP_UNIT"
}

trap cleanup EXIT

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "Missing $SCRIPT_DIR/.env. Copy .env.example first and set NFC_API_KEY."
  exit 1
fi

if [[ -z "$NODE_BINARY" ]]; then
  echo "Node.js is not installed or not in PATH."
  exit 1
fi

if [[ ! -f "$TEMPLATE_PATH" ]]; then
  echo "Missing service template: $TEMPLATE_PATH"
  exit 1
fi

sed \
  -e "s|__USER__|$CURRENT_USER|g" \
  -e "s|__WORKDIR__|$SCRIPT_DIR|g" \
  -e "s|__NODE_BINARY__|$NODE_BINARY|g" \
  "$TEMPLATE_PATH" > "$TEMP_UNIT"

echo "Installing $SERVICE_NAME for user $CURRENT_USER"
echo "Working directory: $SCRIPT_DIR"
echo "Node binary: $NODE_BINARY"

sudo install -m 0644 "$TEMP_UNIT" "/etc/systemd/system/$SERVICE_NAME"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager

echo
echo "The NFC reader will now start automatically on reboot."
echo "Manage it with: sudo systemctl restart|status|stop $SERVICE_NAME"