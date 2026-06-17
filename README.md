# Archisys Attendance — Multi-Tenant HR & Business SaaS

A cloud-hosted, multi-tenant HR management platform with attendance, payroll, CRM, accounting, recruitment, performance management, and more — featuring a web dashboard, mobile app, and on-premise device integration (NFC readers, fingerprint scanners).

## Architecture

```
Cloud (Docker Compose on VPS)                 On-Premise (per office)
┌──────────────────────────────────────┐      ┌──────────────────────┐
│  nginx (reverse proxy + static SPA)  │◄─────│  Browser / Mobile    │
│  ┌──────────┐  ┌───────────┐        │      └──────────────────────┘
│  │ API (v1) │  │ Platform  │        │
│  │  + NFC   │  │  (admin)  │        │      ┌──────────────────────┐
│  └────┬─────┘  └─────┬─────┘        │◄─────│  NFC / FP reader     │
│       │              │              │ HTTPS │  (nfc-reader client) │
│  ┌────┴──────────────┴─────┐        │      └──────────────────────┘
│  │ Accounting │ CRM µservice│        │
│  │  (:3010)   │  (:3011)   │        │
│  └────┬──────────────┬─────┘        │
│       │              │              │
│  ┌────┴──────────────┴─────┐        │
│  │  PostgreSQL 16 │ Redis 7│        │
│  └─────────────────────────┘        │
│  ┌─────────────┐  ┌────────┐        │
│  │ BullMQ      │  │ Backup │        │
│  │ Worker      │  │ (cron) │        │
│  └─────────────┘  └────────┘        │
└──────────────────────────────────────┘
```

## Project Structure

```
├── server/            Node.js + Express API, Prisma ORM, BullMQ workers
│   ├── src/
│   │   ├── routes/v1/       Org-level API (41 route files)
│   │   ├── routes/platform/ Platform admin API
│   │   ├── services/        Business logic layer (27 services)
│   │   ├── middleware/       Auth, CSRF, tenant context, device auth, sanitize
│   │   ├── workers/         Background jobs (email, push, scheduler)
│   │   ├── accounting-service.js  Accounting microservice (:3010)
│   │   └── crm-service.js        CRM microservice (:3011)
│   └── prisma/              Prisma schema + migrations
├── web/               React 18 + Vite + Tailwind CSS
│   └── src/
│       ├── pages/           44 pages (admin + org dashboard)
│       └── platform/pages/  Platform admin portal
├── mobile/            React Native + Expo (SDK 54)
│   └── src/screens/         16 screens
├── nfc-reader/        On-premise NFC reader client (Node.js, nfc-pcsc)
├── docker-compose.yml 8 services: postgres, redis, api, worker, accounting, crm, web, backup
├── deploy.sh          Zero-downtime deploy script
└── webhook.js         GitHub webhook listener for auto-deploy
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **API** | Node.js 20, Express, Prisma 6, JWT (access + refresh tokens) |
| **Database** | PostgreSQL 16, Prisma ORM, tenant isolation with `orgId` |
| **Cache / Queue** | Redis 7, BullMQ (email, push notifications, scheduler) |
| **Web** | React 18, Vite, Tailwind CSS, React Router, Recharts, Lucide |
| **Mobile** | React Native, Expo SDK 54, React Navigation, SecureStore |
| **NFC** | nfc-pcsc (ACR122U), PC/SC protocol |
| **Infrastructure** | Docker Compose, Nginx (container + host), Let's Encrypt, systemd |
| **Security** | Helmet, CORS, CSRF tokens, rate limiting, XSS sanitize, bcrypt-12 |

## Modules

| Module | Description |
|--------|-------------|
| **Attendance** | Check-in/out (web, mobile, NFC, QR, geofence), corrections, overtime |
| **Leave Management** | Multi-type leaves, accrual, sandwich policy, half-day, approval workflow |
| **Payroll** | Salary structures, tax (Nepal), bonuses, incentives, advances, payslips |
| **CRM** | Pipelines, leads, deals (Kanban), clients, contacts, activities, campaigns (telemarketing, email, digital, social media, content, SMS, events) |
| **Accounting** | Chart of accounts, journal entries, ledger, trial balance, P&L, balance sheet |
| **Billing** | Invoices, payments, client billing |
| **HRM** | Employee lifecycle, documents, policies, org chart, branches, shifts, schedules |
| **Performance** | KPIs, review cycles, 360° feedback, performance reviews |
| **Recruitment** | Job postings, applicant tracking, interviews, offers, onboarding |
| **Training** | Training sessions, enrollments, certifications, skill tracking |
| **Self-Service** | Document requests, expense claims, asset management |
| **Projects & Tasks** | Project management, task boards, assignments |
| **Separation** | Resignation, clearance, exit interviews, full-and-final |
| **Compensation** | Salary revisions, festival advances, statutory compliance |
| **Device Management** | NFC readers, fingerprint scanners, heartbeat monitoring |
| **Notifications** | Push (Expo), email (SMTP), in-app notifications |
| **Reports** | Attendance summary, exports, activity logs |

## Multi-Tenancy

- **Shared database** — all tenants in one PostgreSQL instance, isolated by `orgId`
- **Platform admin** — manages organizations, plans, billing, modules, devices
- **Org admin** — manages employees, attendance, leaves, CRM, payroll, settings within their org
- **Role-based access** — custom roles with granular permissions per module
- **Device auth** — physical devices authenticate via `X-Device-Serial` + `X-Api-Key` headers

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

Optional extracted services for CRM/accounting local development:

```bash
cd server
PORT=3010 node src/accounting-service.js
PORT=3011 node src/crm-service.js
```

### 3. Web Dashboard

```bash
cd web
npm install
npm run dev                    # http://localhost:5173
```

The Vite dev proxy routes the main API to `:3001`, accounting/billing to `:3010`, and CRM to `:3011`.

### 4. Mobile App

```bash
cd mobile
npm install
npx expo start                 # Scan QR with Expo Go
```

> For local physical-device testing, update `extra.apiUrl` in `mobile/app.json` to your machine's LAN URL, for example `http://192.168.1.10:3001/api`.

### Local Login Credentials

Do not commit or publish default passwords. Create local admin credentials through `server/.env` before seeding:

```bash
PLATFORM_ADMIN_EMAIL=you@example.com
PLATFORM_ADMIN_PASSWORD=<strong-local-password>
```

For organization admins, use the platform portal to create an organization with a unique admin password. Seeded or temporary users should be reset before any shared demo, staging, or production use.

## API Routes

### Org API (`/api/v1/` or `/api/` for backward compat)

| Group | Key Endpoints |
|-------|--------------|
| **Auth** | POST `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password/verify`, `/auth/reset-password/confirm`, GET `/auth/me` |
| **Attendance** | POST `/attendance/check-in`, `/attendance/check-out`, GET `/attendance/today`, `/attendance/history`, `/attendance/all` |
| **Leaves** | POST `/leaves`, GET `/leaves/my`, `/leaves/all`, PUT `/leaves/:id/review` |
| **Employees** | GET `/employees`, POST `/employees`, PUT `/employees/:id`, POST `/employees/:id/reset-password` |
| **NFC** | POST `/nfc/tap`, `/nfc/heartbeat`, GET `/nfc/cards`, `/nfc/reader-status`, `/nfc/tap-log`, `/nfc/write-jobs` |
| **Dashboard** | GET `/dashboard/stats`, `/dashboard/activity-log`, `/dashboard/weekly-trend` |
| **Settings** | GET/PUT `/settings`, shifts, schedules, assignments, branding upload/serve |
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
| **CRM** | Served by CRM service: CRUD `/crm/pipelines`, `/crm/clients`, `/crm/leads`, `/crm/deals`, `/crm/activities`, `/crm/campaigns` |
| **Accounting** | Served by Accounting service: CRUD `/accounting/accounts`, `/accounting/journals`, GET `/accounting/ledger`, `/accounting/reports/*` |
| **Billing** | Served by Accounting service: CRUD `/billing/invoices`, `/billing/payments`, GET `/billing/dashboard` |
| **Performance** | CRUD `/performance/kpis`, `/performance/reviews`, `/performance/cycles` |
| **Recruitment** | CRUD `/recruitment/jobs`, `/recruitment/applicants`, `/recruitment/interviews` |
| **Training** | CRUD `/training/sessions`, `/training/enrollments`, `/training/certifications` |
| **HRM** | `/hrm/documents`, `/hrm/policies`, `/hrm/org-chart`, `/hrm/separation` |
| **Compensation** | `/compensation/revisions`, `/compensation/advances`, `/compensation/bonuses` |

### Platform API (`/api/platform/`)

| Group | Key Endpoints |
|-------|--------------|
| **Auth** | POST `/auth/login`, GET `/auth/me` |
| **Organizations** | CRUD `/organizations`, suspend/reactivate, module assignment |
| **Org Admin Access** | POST `/organizations/:id/admin-password-reset-link` |
| **Plans** | CRUD `/plans` |
| **Billing** | CRUD `/billing`, invoice payment |
| **Modules** | GET `/modules` |
| **Users** | CRUD `/users` |
| **Devices** | GET/POST `/devices`, deactivate/reactivate, key rotation |
| **Dashboard** | GET `/dashboard` |
| **App Update** | POST `/app-update/upload`, GET/DELETE `/app-update/current` |

### Microservices

| Service | Port | Route Prefix | Modules |
|---------|------|--------------|---------|
| **API** (main) | 3001 | `/api/v1/*` | Auth, Attendance, Leaves, Employees, NFC, Payroll, HRM, Performance, etc. |
| **Accounting** | 3010 | `/api/v1/accounting/*`, `/api/v1/billing/*` | Chart of Accounts, Journals, Ledger, Invoices, Payments |
| **CRM** | 3011 | `/api/v1/crm/*` | Pipelines, Clients, Leads, Deals, Activities, Campaigns |

## Production Deployment

See [HOSTING.md](HOSTING.md) for complete deployment instructions covering:

- **Docker Compose** (8 services) on a VPS (recommended)
- **SSL/TLS** with Let's Encrypt
- **Automated deploys** via GitHub webhook
- **Database backups** (daily, 30-day retention)
- **NFC reader setup** at office locations
- **Mobile app builds** with EAS

See [INFRASTRUCTURE.md](INFRASTRUCTURE.md) for the system architecture diagram, microservice topology, and data flow.

Production containers do not run `prisma db push` on startup. Apply migrations explicitly with `npx prisma migrate deploy` during deployment, then start/restart the API, worker, accounting, and CRM services.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `POSTGRES_USER` | Compose | PostgreSQL user for Docker Compose |
| `POSTGRES_PASSWORD` | Compose | PostgreSQL password; required by Docker Compose and backup scripts |
| `POSTGRES_DB` | Compose | PostgreSQL database name |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `REDIS_URL` | No | Redis connection (default: `redis://localhost:6379`) |
| `REDIS_PASSWORD` | Compose | Redis password; required by Docker Compose |
| `PORT` | No | API port (default: `3001`) |
| `CORS_ORIGIN` | Prod | Comma-separated allowed origins |
| `WEB_APP_URL` | Password reset | Public web app URL used in emailed reset links |
| `SMTP_HOST` | No | Email server host |
| `SMTP_PORT` | No | Email server port (default: `587`) |
| `SMTP_USER` | No | Email username |
| `SMTP_PASS` | No | Email password |
| `SMTP_FROM` | No | From address (default: `noreply@archisysinnovation.com`) |
| `NOTIFY_EMAIL` | No | Admin notification recipient |
| `PLATFORM_ADMIN_EMAIL` | Yes for seeding | Initial platform admin email; use an environment-specific address |
| `PLATFORM_ADMIN_PASSWORD` | Yes for seeding | Initial platform admin password; use a strong secret and do not commit it |

## Password Recovery

Employee and organization-admin password recovery uses short-lived, single-use reset links:

- Public users can request a link from `/forgot-password`.
- Reset links open `/reset-password?token=...`.
- Tokens are stored hashed in `password_reset_tokens`, expire after 30 minutes, and are revoked after use.
- Platform super admins can send reset links to active organization admins from the organization detail page.
- Successful reset clears lockout counters, clears `mustChangePassword`, and revokes existing refresh tokens.

## License

Proprietary — Archisys Innovations © 2026
