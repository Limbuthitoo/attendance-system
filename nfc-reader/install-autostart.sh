#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="archisys-nfc-reader.service"
POLKIT_RULE_NAME="49-archisys-nfc-reader.rules"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_PATH="$SCRIPT_DIR/archisys-nfc-reader.service.example"
POLKIT_TEMPLATE_PATH="$SCRIPT_DIR/archisys-nfc-reader.pcsc.rules.example"
CURRENT_USER="${SUDO_USER:-$(id -un)}"
CURRENT_HOME="$(eval echo "~$CURRENT_USER")"
NODE_BINARY="$(su - "$CURRENT_USER" -c 'source ~/.nvm/nvm.sh 2>/dev/null; command -v node' 2>/dev/null || command -v node || true)"
TEMP_UNIT="$(mktemp)"
TEMP_POLKIT_RULE="$(mktemp)"

cleanup() {
  rm -f "$TEMP_UNIT"
  rm -f "$TEMP_POLKIT_RULE"
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

if [[ ! -f "$POLKIT_TEMPLATE_PATH" ]]; then
  echo "Missing polkit template: $POLKIT_TEMPLATE_PATH"
  exit 1
fi

sed \
  -e "s|__USER__|$CURRENT_USER|g" \
  -e "s|__WORKDIR__|$SCRIPT_DIR|g" \
  -e "s|__NODE_BINARY__|$NODE_BINARY|g" \
  "$TEMPLATE_PATH" > "$TEMP_UNIT"

sed \
  -e "s|__USER__|$CURRENT_USER|g" \
  "$POLKIT_TEMPLATE_PATH" > "$TEMP_POLKIT_RULE"

echo "Installing $SERVICE_NAME for user $CURRENT_USER"
echo "Working directory: $SCRIPT_DIR"
echo "Node binary: $NODE_BINARY"

sudo install -m 0644 "$TEMP_UNIT" "/etc/systemd/system/$SERVICE_NAME"
sudo install -m 0644 "$TEMP_POLKIT_RULE" "/etc/polkit-1/rules.d/$POLKIT_RULE_NAME"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager

echo
echo "The NFC reader will now start automatically on reboot."
echo "Installed PolicyKit rule: /etc/polkit-1/rules.d/$POLKIT_RULE_NAME"
echo "Manage it with: sudo systemctl restart|status|stop $SERVICE_NAME"