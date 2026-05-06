# Archisys Attendance — Multi-Tenant SaaS

A cloud-hosted, multi-tenant attendance management platform with a web dashboard, mobile app, and on-premise device integration (NFC readers, fingerprint scanners).

## Architecture

```
Cloud (Docker Compose on VPS)                 On-Premise (per office)
┌──────────────────────────────────────┐      ┌──────────────────────┐
│  nginx (reverse proxy + static SPA)  │◄─────│  Browser / Mobile    │
│  ┌──────────┐  ┌───────────┐         │      └──────────────────────┘
│  │ API (v1) │  │ Platform  │         │
│  │  + NFC   │  │  (admin)  │         │      ┌──────────────────────┐
│  └────┬─────┘  └─────┬─────┘         │◄─────│  NFC / FP reader     │
│       │              │               │ HTTPS │  (nfc-reader client) │
│  ┌────┴──────────────┴─────┐         │      └──────────────────────┘
│  │  PostgreSQL 16 │ Redis 7│         │
│  └─────────────────────────┘         │
│  ┌─────────────┐  ┌────────┐         │
│  │ BullMQ      │  │ Backup │         │
│  │ Worker      │  │ (cron) │         │
│  └─────────────┘  └────────┘         │
└──────────────────────────────────────┘
```

## Project Structure

```
├── server/            Node.js + Express API, Prisma ORM, BullMQ workers
│   ├── src/
│   │   ├── routes/v1/       Org-level API (auth, attendance, leaves, NFC, …)
│   │   ├── routes/platform/ Platform admin API (orgs, plans, billing, devices, …)
│   │   ├── services/        Business logic layer
│   │   ├── middleware/       Auth, CSRF, tenant context, device auth, sanitize
│   │   ├── workers/         Background jobs (email, push, scheduler)
│   │   └── config/          Env loader, Redis, BullMQ queues
│   └── prisma/              Schema (31 models) + migrations
├── web/               React 18 + Vite + Tailwind CSS
│   └── src/
│       ├── pages/           Org admin dashboard (26 pages)
│       └── platform/pages/  Platform admin portal (11 pages)
├── mobile/            React Native + Expo (SDK 54)
│   └── src/screens/         13 screens (attendance, leaves, QR, …)
├── nfc-reader/        On-premise NFC reader client (Node.js, nfc-pcsc)
├── docker-compose.yml 6 services: postgres, redis, api, worker, web, backup
├── deploy.sh          Zero-downtime deploy script
└── webhook.js         GitHub webhook listener for auto-deploy
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | Node.js 20, Express, Prisma 6, JWT (access + refresh tokens) |
| **Database** | PostgreSQL 16 (shared-database multi-tenancy with `orgId`) |
| **Cache / Queue** | Redis 7, BullMQ (email, push notifications, scheduler) |
| **Web** | React 18, Vite, Tailwind CSS, React Router, Recharts, Lucide |
| **Mobile** | React Native, Expo SDK 54, React Navigation, SecureStore |
| **NFC** | nfc-pcsc (ACR122U), PC/SC protocol |
| **Infrastructure** | Docker Compose, Nginx, Let's Encrypt, systemd |
| **Security** | Helmet, CORS, CSRF tokens, rate limiting, XSS sanitize, bcrypt-12 |

## Multi-Tenancy

- **Shared database** — all tenants in one PostgreSQL instance, isolated by `orgId`
- **Platform admin** — manages organizations, plans, billing, modules, devices
- **Org admin** — manages employees, attendance, leaves, NFC, settings within their org
- **Device auth** — physical devices (NFC readers, fingerprint scanners) authenticate via `X-Device-Serial` + `X-Api-Key` headers, registered through platform admin

## Quick Start (Local Development)

### Prerequisites

- Node.js 20+, Docker (for PostgreSQL + Redis), Git

### 1. Database + Redis

```bash
docker compose up -d postgres redis
```

### 2. API Server

```bash
cd server
cp .env.example .env          # Edit DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma migrate deploy     # Apply migrations
node src/seed.js               # Seed platform admin + sample org
node src/index.js              # http://localhost:3001
```

### 3. Web Dashboard

```bash
cd web
npm install
npm run dev                    # http://localhost:5173 (proxies /api → :3001)
```

### 4. Mobile App

```bash
cd mobile
npm install
npx expo start                 # Scan QR with Expo Go
```

> Update `API_BASE` in `mobile/src/api.js` to your machine's IP for physical devices.

### Default Credentials

| Portal | Email | Password |
|--------|-------|----------|
| **Platform Admin** | admin@attendance.app | Admin@123! |
| **Org Admin** | admin@archisys.com | admin123 |

## API Routes

### Org API (`/api/v1/` or `/api/` for backward compat)

| Group | Key Endpoints |
|-------|--------------|
| **Auth** | POST `/auth/login`, `/auth/refresh`, `/auth/logout`, GET `/auth/me` |
| **Attendance** | POST `/attendance/check-in`, `/attendance/check-out`, GET `/attendance/today`, `/attendance/history`, `/attendance/all` |
| **Leaves** | POST `/leaves`, GET `/leaves/my`, `/leaves/all`, PUT `/leaves/:id/review` |
| **Employees** | GET `/employees`, POST `/employees`, PUT `/employees/:id`, POST `/employees/:id/reset-password` |
| **NFC** | POST `/nfc/tap`, `/nfc/heartbeat`, GET `/nfc/cards`, `/nfc/reader-status`, `/nfc/tap-log`, `/nfc/write-jobs` |
| **Dashboard** | GET `/dashboard/stats`, `/dashboard/activity-log`, `/dashboard/weekly-trend` |
| **Settings** | GET/PUT `/settings`, shifts, schedules, assignments, branding |
| **Reports** | GET `/reports/attendance-summary`, `/reports/export/attendance` |
| **QR** | POST `/qr/generate-location`, `/qr/scan` |
| **Devices** | POST `/devices/event`, `/devices/heartbeat`, GET `/devices` |
| **Holidays** | CRUD `/holidays` |
| **Notices** | CRUD `/notices` |
| **Overtime** | GET/POST `/overtime/policies`, PUT `/overtime/records/:id/review` |
| **Payroll** | POST `/payroll/generate`, GET `/payroll/summaries`, `/payroll/export` |
| **Geofence** | GET/PUT `/geofence/:branchId`, POST `/geofence/validate` |
| **Roles** | CRUD `/roles`, POST `/roles/assign`, `/roles/remove` |
| **App Update** | GET `/app-update/check`, `/app-update/download` |

### Platform API (`/api/platform/`)

| Group | Key Endpoints |
|-------|--------------|
| **Auth** | POST `/auth/login`, GET `/auth/me` |
| **Organizations** | CRUD `/organizations`, suspend/reactivate, module assignment |
| **Plans** | CRUD `/plans` |
| **Billing** | CRUD `/billing`, invoice payment |
| **Modules** | GET `/modules` |
| **Users** | CRUD `/users` |
| **Devices** | GET/POST `/devices`, deactivate/reactivate, key rotation |
| **Dashboard** | GET `/dashboard` |
| **App Update** | POST `/app-update/upload`, GET/DELETE `/app-update/current` |

## Production Deployment

See [HOSTING.md](HOSTING.md) for complete deployment instructions covering:

- **Docker Compose** on a VPS (recommended)
- **SSL/TLS** with Let's Encrypt
- **Automated deploys** via GitHub webhook
- **Database backups** (daily, 30-day retention)
- **NFC reader setup** at office locations
- **Mobile app builds** with EAS

See [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for the system architecture diagram and service topology.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `REDIS_URL` | No | Redis connection (default: `redis://localhost:6379`) |
| `PORT` | No | API port (default: `3001`) |
| `CORS_ORIGIN` | Prod | Comma-separated allowed origins |
| `SMTP_HOST` | No | Email server host |
| `SMTP_PORT` | No | Email server port (default: `587`) |
| `SMTP_USER` | No | Email username |
| `SMTP_PASS` | No | Email password |
| `SMTP_FROM` | No | From address (default: `noreply@archisysinnovation.com`) |
| `NOTIFY_EMAIL` | No | Admin notification recipient |
| `PLATFORM_ADMIN_EMAIL` | No | Initial platform admin email |
| `PLATFORM_ADMIN_PASSWORD` | No | Initial platform admin password |

## License

Proprietary — Archisys Innovations © 2026
