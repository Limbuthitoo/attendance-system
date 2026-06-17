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

# Build and deploy frontend
log "Building frontend..."
cd "$PROJECT_DIR/web"
npm install --legacy-peer-deps 2>&1 | tee -a "$LOG_FILE"
npm run build 2>&1 | tee -a "$LOG_FILE"

log "Deploying frontend to nginx..."
sudo cp -r dist/* /var/www/html/
sudo systemctl reload nginx

log "=== Deployment completed ==="
