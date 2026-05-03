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
BACKUP_DIR="$PROJECT_DIR/backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/pre_deploy_$(date +%Y%m%d_%H%M%S).sql.gz"
log "Creating pre-deploy database backup..."
if pg_dump -h localhost -U attendance -d attendance --no-owner --no-privileges | gzip > "$BACKUP_FILE"; then
  log "Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
else
  log "WARNING: Pre-deploy backup failed — proceeding with caution"
fi
# Keep only last 10 pre-deploy backups
ls -t "$BACKUP_DIR"/pre_deploy_*.sql.gz 2>/dev/null | tail -n +11 | xargs -r rm -f

# Pull latest code
log "Pulling latest code..."
if ! git pull origin main 2>&1 | tee -a "$LOG_FILE"; then
  log "ERROR: git pull failed — aborting deploy"
  exit 1
fi

# Install server dependencies
log "Installing server dependencies..."
cd "$PROJECT_DIR/server"
npm install --production 2>&1 | tee -a "$LOG_FILE"

# Run database migrations
log "Running database migrations..."
npx prisma migrate deploy 2>&1 | tee -a "$LOG_FILE"

# Restart backend
log "Restarting backend server..."
export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
pm2 restart attendance-server
sleep 3

# Verify backend is up
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
cp -r dist/* /var/www/html/
sudo systemctl reload nginx

log "=== Deployment completed ==="
