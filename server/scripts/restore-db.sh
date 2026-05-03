#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Database Restore Script — Restore from a backup file
# Usage: ./restore-db.sh <backup_file.sql.gz>
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <backup_file.sql.gz>"
  echo ""
  echo "Available backups:"
  ls -lht "${BACKUP_DIR:-/backups}"/*.sql.gz 2>/dev/null || echo "  (none found)"
  exit 1
fi

BACKUP_FILE="$1"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-attendance}"
DB_NAME="${POSTGRES_DB:-attendance}"

export PGPASSWORD="${POSTGRES_PASSWORD:-attendance_pass}"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found: $BACKUP_FILE"
  exit 1
fi

echo "⚠️  WARNING: This will REPLACE all data in '${DB_NAME}' with the backup."
echo "   Backup: ${BACKUP_FILE}"
echo ""
read -p "Type 'RESTORE' to confirm: " CONFIRM
if [ "$CONFIRM" != "RESTORE" ]; then
  echo "Aborted."
  exit 0
fi

echo "Restoring ${BACKUP_FILE} → ${DB_NAME}..."

# Drop and recreate database
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
  SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();
"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"${DB_NAME}\";"
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"${DB_NAME}\";"

# Restore
gunzip -c "$BACKUP_FILE" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" --quiet

echo "✓ Restore completed successfully"
