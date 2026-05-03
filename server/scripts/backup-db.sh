#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Database Backup Script — Automated PostgreSQL backups with retention
# Run via cron: 0 2 * * * /path/to/backup-db.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Config (override via env vars)
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-attendance}"
DB_NAME="${POSTGRES_DB:-attendance}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${TIMESTAMP}.sql.gz"

export PGPASSWORD="${POSTGRES_PASSWORD:-attendance_pass}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Create compressed backup
log "Starting backup: ${DB_NAME} → ${BACKUP_FILE}"
if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    --no-owner --no-privileges --format=plain | gzip > "$BACKUP_FILE"; then
  FILESIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  log "✓ Backup completed: ${BACKUP_FILE} (${FILESIZE})"
else
  log "✗ Backup FAILED"
  rm -f "$BACKUP_FILE"
  exit 1
fi

# Cleanup old backups (keep last N days)
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
log "  Deleted ${DELETED} old backup(s)"

# List current backups
TOTAL=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "  Current backups: ${TOTAL} files (${TOTAL_SIZE} total)"

log "Backup job complete"
