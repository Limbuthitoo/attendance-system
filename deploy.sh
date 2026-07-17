#!/bin/bash
set -e

PROJECT_DIR="/home/ubuntu/attendance/attendance-system"
LOG_FILE="/var/log/attendance-deploy.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=== Deployment started ==="

cd "$PROJECT_DIR"

# ── Pre-deploy database backup ──────────────────────────────────────────────
log "Creating pre-deploy database backup..."
if sudo docker exec attendance-system-backup-1 /scripts/backup-db.sh 2>&1 | tee -a "$LOG_FILE"; then
  log "Pre-deploy backup completed"
else
  log "WARNING: Pre-deploy backup failed — proceeding with caution"
fi

# Pull latest code
log "Pulling latest code..."
if ! git pull origin main 2>&1 | tee -a "$LOG_FILE"; then
  log "ERROR: git pull failed — aborting deploy"
  exit 1
fi

# Rebuild backend images first so migrations run from the freshly pulled code
log "Rebuilding backend images..."
sudo docker compose build api accounting crm --quiet 2>&1 | tee -a "$LOG_FILE"

# Run database migrations from the new API image
log "Running database migrations..."
sudo docker compose run --rm api npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"

# Restart backend services
log "Restarting backend services..."
sudo docker compose up -d api worker accounting crm 2>&1 | tee -a "$LOG_FILE"

# Wait for health check
sleep 10
if curl -s http://localhost:3001/api/health | grep -q ok; then
  log "Backend restarted successfully"
else
  log "WARNING: Backend may not have started correctly"
fi

# Build and restart the frontend container. The public nginx virtual host
# proxies application traffic to this container on 127.0.0.1:8080.
log "Rebuilding frontend image..."
cd "$PROJECT_DIR"
sudo docker compose build web --quiet 2>&1 | tee -a "$LOG_FILE"

log "Restarting frontend container..."
sudo docker compose up -d web 2>&1 | tee -a "$LOG_FILE"

if curl -s http://127.0.0.1:8080/ | grep -q '<div id="root"></div>'; then
  log "Frontend restarted successfully"
else
  log "WARNING: Frontend may not have started correctly"
fi

sudo systemctl reload nginx

log "=== Deployment completed ==="
