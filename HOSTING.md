# Archisys Attendance — Hosting & Deployment Guide

Production hosting guide for the multi-tenant attendance SaaS platform.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [VPS Setup](#2-vps-setup)
3. [Deploy with Docker Compose](#3-deploy-with-docker-compose)
4. [SSL/TLS with Nginx & Let's Encrypt](#4-ssltls-with-nginx--lets-encrypt)
5. [Automated Deploys (GitHub Webhook)](#5-automated-deploys-github-webhook)
6. [Database Backups](#6-database-backups)
7. [NFC Reader Setup (On-Premise)](#7-nfc-reader-setup-on-premise)
8. [Mobile App Distribution](#8-mobile-app-distribution)
9. [Monitoring & Maintenance](#9-monitoring--maintenance)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Prerequisites

| Requirement | Minimum |
|-------------|---------|
| VPS | Ubuntu 22.04+, 2 vCPU, 2 GB RAM, 40 GB SSD |
| Domain | A domain with DNS pointing to your VPS IP |
| Docker | Docker Engine 24+ with Compose V2 |
| Git | Access to the repository |

Recommended providers: DigitalOcean, Hetzner, AWS Lightsail, Vultr, Linode.

---

## 2. VPS Setup

### 2.1 Initial Server Setup

```bash
# SSH into your server
ssh root@your-server-ip

# Create a deploy user
adduser ubuntu
usermod -aG sudo ubuntu

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker ubuntu

# Install Nginx (host-level reverse proxy)
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx git

# Switch to deploy user
su - ubuntu
```

### 2.2 Clone the Repository

```bash
mkdir -p ~/attendance
cd ~/attendance
git clone https://github.com/YOUR_USERNAME/attendance-system.git
cd attendance-system
```

---

## 3. Deploy with Docker Compose

### 3.1 Environment Configuration

Create a `.env` file in the project root:

```bash
cp server/.env.example .env
```

Edit `.env` with production values:

```env
# ── Database ─────────────────────────────────────────
POSTGRES_USER=attendance
POSTGRES_PASSWORD=<strong-random-password>
POSTGRES_DB=attendance

# ── Redis ────────────────────────────────────────────
REDIS_PASSWORD=<strong-random-password>

# ── API Server ───────────────────────────────────────
JWT_SECRET=<64-char-random-string>
CORS_ORIGIN=https://yourdomain.com
NODE_ENV=production

# ── Platform Admin (first-run seed) ─────────────────
PLATFORM_ADMIN_EMAIL=admin@yourdomain.com
PLATFORM_ADMIN_PASSWORD=<strong-password>

# ── Email (optional, for notifications) ─────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
NOTIFY_EMAIL=admin@yourdomain.com

# ── Frontend ─────────────────────────────────────────
VITE_API_URL=https://yourdomain.com
```

> Generate secrets: `openssl rand -hex 32`

### 3.2 Docker Compose Services

The `docker-compose.yml` runs 6 services:

| Service | Image | Purpose |
|---------|-------|---------|
| `postgres` | postgres:16-alpine | Primary database |
| `redis` | redis:7-alpine | Cache, session store, job queue |
| `api` | ./server (Dockerfile) | Express API server on :3001 |
| `worker` | ./server (Dockerfile) | BullMQ background worker (email, push, scheduler) |
| `web` | ./web (Dockerfile) | Nginx serving the React SPA on :8080 |
| `backup` | postgres:16-alpine | Daily database backups at 2 AM UTC |

### 3.3 Start All Services

```bash
# Build and start everything
docker compose up -d --build

# Check all services are healthy
docker compose ps

# View API logs
docker compose logs -f api

# Run seed (first time only — creates platform admin + default org)
docker compose exec api node src/seed.js
```

### 3.4 Verify

```bash
# Health check
curl http://localhost:3001/api/health
# → {"status":"ok","version":"2.0.0","timestamp":"..."}

# Web frontend
curl -s http://localhost:8080 | head -5
```

---

## 4. SSL/TLS with Nginx & Let's Encrypt

The Docker `web` container serves the SPA on port 8080 and proxies `/api/` to the API container. A host-level Nginx acts as the public-facing reverse proxy with SSL.

### 4.1 Nginx Site Config

Create `/etc/nginx/sites-available/attendance`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect HTTP → HTTPS (certbot will add this)
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL certs (managed by certbot)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=63072000" always;

    # API proxy (to Docker API container)
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE support (for real-time NFC events)
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;
    }

    # APK downloads (larger file uploads)
    location /api/v1/app-update/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 100M;
    }

    # Web frontend (Docker Nginx container)
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 4.2 Enable & Get SSL Certificate

```bash
sudo ln -sf /etc/nginx/sites-available/attendance /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Get SSL certificate (follow the prompts)
sudo certbot --nginx -d yourdomain.com
```

Certbot auto-renews via a systemd timer. Verify:
```bash
sudo certbot renew --dry-run
```

---

## 5. Automated Deploys (GitHub Webhook)

The repo includes `webhook.js` — a lightweight listener that triggers `deploy.sh` on push to `main`.

### 5.1 Setup

```bash
# Install the webhook listener as a systemd service
sudo tee /etc/systemd/system/attendance-webhook.service > /dev/null <<EOF
[Unit]
Description=Attendance Deploy Webhook
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/attendance/attendance-system
ExecStart=/usr/bin/node webhook.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable --now attendance-webhook
```

### 5.2 GitHub Webhook

1. Go to your repo → **Settings** → **Webhooks** → **Add webhook**
2. **Payload URL:** `https://yourdomain.com:9000/webhook` (or proxy through Nginx)
3. **Content type:** `application/json`
4. **Secret:** Set a webhook secret and add it to your `.env`
5. **Events:** Just the push event

### 5.3 Deploy Script

`deploy.sh` performs:
1. Pre-deploy database backup
2. `git pull origin main`
3. `prisma migrate deploy` (inside the API container)
4. Rebuild and restart `api` + `worker` containers
5. Health check
6. `npm install && npm run build` for the web frontend
7. Copy built assets to the Nginx document root
8. Reload Nginx

To deploy manually:
```bash
cd ~/attendance/attendance-system
./deploy.sh
```

---

## 6. Database Backups

### Automated (Docker Compose)

The `backup` service in `docker-compose.yml` runs a cron job at **2:00 AM UTC daily**:
- Dumps the full PostgreSQL database to `/backups/`
- Retains backups for 30 days (configurable via `BACKUP_RETENTION_DAYS`)
- Backup volume: `backup-data` (Docker named volume)

### Manual Backup

```bash
# Trigger a backup now
docker compose exec backup /scripts/backup-db.sh

# List backups
docker compose exec backup ls -la /backups/

# Copy a backup to the host
docker cp $(docker compose ps -q backup):/backups/latest.sql.gz ./backup.sql.gz
```

### Restore

```bash
# Stop the API and worker first
docker compose stop api worker

# Restore from backup
gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U attendance -d attendance

# Restart services
docker compose start api worker
```

---

## 7. NFC Reader Setup (On-Premise)

NFC readers run as local clients at each office location. They connect **outbound** to your cloud server over HTTPS — no VPN or port forwarding needed.

### 7.1 How It Works

```
┌─────────────────────────┐         HTTPS          ┌──────────────────────┐
│  Office PC              │ ──────────────────────► │  Cloud Server        │
│  + ACR122U USB reader   │                         │                      │
│  + nfc-reader/ client   │  POST /api/nfc/tap      │  yourdomain.com      │
│                         │  POST /api/nfc/heartbeat│                      │
│                         │  GET  /api/nfc/write-*  │                      │
└─────────────────────────┘                         └──────────────────────┘
```

### 7.2 Register the Device

1. Log into **Platform Admin** → **Devices** → **Register Device**
2. Select the organization, device type = `NFC_READER`
3. Enter serial (e.g., `NFC-RECEPTION-01`), brand (`ACS`), model (`ACR122U`)
4. **Copy the API key** — it is shown only once

### 7.3 Setup the Reader PC

Any PC (Windows / macOS / Linux) with a USB port:

```bash
# Get the reader client
git clone https://github.com/YOUR_USERNAME/attendance-system.git
cd attendance-system/nfc-reader
npm install

# Configure
cp .env.example .env
```

Edit `.env`:
```env
API_URL=https://yourdomain.com
DEVICE_SERIAL=NFC-RECEPTION-01
NFC_API_KEY=dev_xxxxxxxxxxxxxxxxxx
DEVICE_ID=reception-01
DEBOUNCE_SECONDS=10
ACTION_COOLDOWN_SECONDS=30
```

### 7.4 Install PC/SC Drivers

**Linux (Ubuntu/Debian):**
```bash
sudo apt install -y pcscd libpcsclite1 libpcsclite-dev
sudo systemctl enable --now pcscd
```

**macOS:** Built-in support, no installation needed.

**Windows:** Install drivers from https://www.acs.com.hk/en/driver/3/acr122u-usb-nfc-reader/

### 7.5 Start the Reader

```bash
# Plug in the ACR122U, then:
npm start
```

Expected output:
```
╔═══════════════════════════════════════╗
║   Archisys NFC Reader                ║
║   Serial: NFC-RECEPTION-01           ║
║   → https://yourdomain.com           ║
╚═══════════════════════════════════════╝
```

### 7.6 Run as a Service

**Linux (systemd — recommended for unattended machines):**
```bash
chmod +x install-autostart.sh
./install-autostart.sh
```

This installs `archisys-nfc-reader.service` with auto-restart on crash.

```bash
# Useful commands
sudo systemctl status archisys-nfc-reader
sudo journalctl -u archisys-nfc-reader -f
```

**Linux (user login autostart):**
```bash
./install-login-autostart.sh
```

**Windows:** Use `start.bat` or configure as a Windows Service.

**macOS:** Use `start.command` or create a LaunchAgent.

### 7.7 Multiple Locations

Register a separate device per location in Platform Admin. Each office PC gets its own serial and API key. The **NFC Management** page in the org dashboard shows all reader statuses.

---

## 8. Mobile App Distribution

### 8.1 Configure API URL

Edit `mobile/src/api.js`:
```javascript
const API_BASE = 'https://yourdomain.com/api';
```

### 8.2 Build with EAS (Expo Application Services)

```bash
cd mobile
npm install -g eas-cli
eas login

# Android APK (free, no account needed)
eas build --platform android --profile preview

# Android Play Store bundle
eas build --platform android --profile production

# iOS (requires Apple Developer account — $99/year)
eas build --platform ios --profile production
```

### 8.3 Self-Hosted APK Updates

The platform includes a built-in app update system:

1. **Platform Admin** → **App Update** → Upload new APK
2. The mobile app checks for updates on launch via `GET /api/v1/app-update/check`
3. Users see an update prompt with download link

---

## 9. Monitoring & Maintenance

### Health Checks

```bash
# API health
curl https://yourdomain.com/api/health

# Docker service status
docker compose ps

# Resource usage
docker stats --no-stream
```

### Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f worker

# Deploy log
tail -f /var/log/attendance-deploy.log
```

### Database Migrations

When updating the schema:

```bash
# Inside the API container
docker compose exec api npx prisma migrate deploy

# Or during deploy (handled automatically by deploy.sh)
```

### Scaling Considerations

| Metric | Action |
|--------|--------|
| High API load | Scale horizontally with load balancer + multiple API containers |
| Large database | Add read replicas, enable connection pooling (PgBouncer) |
| Many orgs | Consider partitioning by org; the current shared-DB model handles hundreds of orgs |
| Queue bottleneck | Run multiple worker containers |

---

## 10. Troubleshooting

### API won't start

```bash
docker compose logs api
# Check for missing env vars (DATABASE_URL, JWT_SECRET are required)
```

### Database connection refused

```bash
# Ensure postgres is healthy
docker compose ps postgres
docker compose exec postgres pg_isready
```

### NFC reader not detected (Linux)

```bash
# Check if pcscd sees the reader
pcsc_scan

# If Ubuntu bound the reader to kernel NFC driver:
sudo modprobe -r pn533_usb pn533 nfc
sudo systemctl restart pcscd
```

### NFC reader auth failures

```bash
# Verify the device is registered and active in Platform Admin → Devices
# Ensure DEVICE_SERIAL in .env matches the registered serial exactly
# Ensure NFC_API_KEY is the key shown during registration (not rotated)
```

### SSL certificate renewal fails

```bash
sudo certbot renew --dry-run
# Check Nginx config is valid
sudo nginx -t
```

### Mobile app can't reach the server

- Ensure `CORS_ORIGIN` includes your domain
- Ensure the API URL in `mobile/src/api.js` uses HTTPS
- Check the phone has internet access
- If using a custom domain, ensure DNS is propagated: `dig yourdomain.com`
