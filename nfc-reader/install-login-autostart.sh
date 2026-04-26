#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AUTOSTART_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/autostart"
DESKTOP_TEMPLATE="$SCRIPT_DIR/archisys-nfc-reader.desktop.example"
DESKTOP_TARGET="$AUTOSTART_DIR/archisys-nfc-reader.desktop"
TEMP_DESKTOP="$(mktemp --suffix=.desktop)"

cleanup() {
  rm -f "$TEMP_DESKTOP"
}

trap cleanup EXIT

if [[ ! -x "$SCRIPT_DIR/start.sh" ]]; then
  chmod +x "$SCRIPT_DIR/start.sh"
fi

if [[ ! -f "$SCRIPT_DIR/.env" ]]; then
  echo "Missing $SCRIPT_DIR/.env. Copy .env.example first and configure it."
  exit 1
fi

mkdir -p "$AUTOSTART_DIR"

sed -e "s|__WORKDIR__|$SCRIPT_DIR|g" "$DESKTOP_TEMPLATE" > "$TEMP_DESKTOP"
install -m 0644 "$TEMP_DESKTOP" "$DESKTOP_TARGET"

echo "Installed login autostart entry at $DESKTOP_TARGET"
echo "The NFC reader will start automatically after this user logs in."
echo "You can test it now with: $SCRIPT_DIR/start.sh"