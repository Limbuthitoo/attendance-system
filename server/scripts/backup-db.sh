#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Database Backup Script — Automated PostgreSQL backups with retention
# Reads backup settings from platform_settings table (DB-driven).
# Falls back to env vars / defaults if DB is unreachable.
# Run via cron: 0 2 * * * /path/to/backup-db.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Config (override via env vars — used as fallback)
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

# ── Read settings from DB (platform_settings table) ─────────────────────────
read_db_setting() {
  local key="$1"
  local default="$2"
  local val
  val=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
    -tAc "SELECT value FROM platform_settings WHERE key = '${key}' LIMIT 1" 2>/dev/null || echo "")
  echo "${val:-$default}"
}

# Check if backups are enabled
BACKUP_ENABLED=$(read_db_setting "backup_enabled" "true")
if [ "$BACKUP_ENABLED" = "false" ]; then
  log "⏭  Backups disabled in platform settings. Exiting."
  exit 0
fi

# Read global retention from DB, fallback to env
DB_RETENTION=$(read_db_setting "backup_retention_days" "$RETENTION_DAYS")
RETENTION_DAYS="${DB_RETENTION}"
log "Retention policy: ${RETENTION_DAYS} days (from platform settings)"

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

# Cleanup old backups (keep last N days based on global retention)
log "Cleaning up backups older than ${RETENTION_DAYS} days..."
DELETED=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -mtime +${RETENTION_DAYS} -delete -print | wc -l)
log "  Deleted ${DELETED} old backup(s)"

# List current backups
TOTAL=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" | wc -l)
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
log "  Current backups: ${TOTAL} files (${TOTAL_SIZE} total)"

log "Backup job complete"
