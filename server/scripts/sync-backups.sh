#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Off-site Backup Sync — Syncs local backups to a remote server via rsync/SSH
# Configure REMOTE_BACKUP_TARGET in .env or set below.
# Usage: Run via cron (e.g., 0 3 * * * /path/to/sync-backups.sh)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

LOCAL_BACKUP_DIR="/opt/attendance-backups"
REMOTE_BACKUP_TARGET="${REMOTE_BACKUP_TARGET:-}"  # e.g., user@remote:/backups/attendance/

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

if [[ -z "$REMOTE_BACKUP_TARGET" ]]; then
  log "⚠ REMOTE_BACKUP_TARGET not set. Skipping off-site sync."
  log "  Set it to something like: user@backupserver:/backups/attendance/"
  exit 0
fi

if [[ ! -d "$LOCAL_BACKUP_DIR" ]]; then
  log "✗ Local backup directory not found: $LOCAL_BACKUP_DIR"
  exit 1
fi

log "Starting off-site backup sync → $REMOTE_BACKUP_TARGET"
if rsync -az --delete "$LOCAL_BACKUP_DIR/" "$REMOTE_BACKUP_TARGET"; then
  log "✓ Off-site sync completed successfully"
else
  log "✗ Off-site sync FAILED"
  exit 1
fi
