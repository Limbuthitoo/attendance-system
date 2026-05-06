# Infrastructure — System Architecture

Detailed view of the Archisys Attendance platform infrastructure, service topology, and data flow.

---

## Service Topology

```
                            ┌─────────────────────────────────────────────────────┐
                            │                    INTERNET                          │
                            └────────────┬───────────────────┬────────────────────┘
                                         │                   │
                                    HTTPS (443)         HTTPS (443)
                                         │                   │
                            ┌────────────▼───────────────────▼────────────────────┐
                            │              HOST: Nginx Reverse Proxy               │
                            │              (Let's Encrypt SSL/TLS)                 │
                            │                                                      │
                            │   /api/*  ──►  127.0.0.1:3001 (API container)       │
                            │   /*      ──►  127.0.0.1:8080 (Web container)       │
                            └────────────┬───────────────────┬────────────────────┘
                                         │                   │
                         ┌───────────────┘                   └───────────────┐
                         ▼                                                   ▼
            ┌────────────────────────┐                          ┌──────────────────┐
            │   Docker: api (:3001)  │                          │ Docker: web (:80) │
            │                        │                          │                   │
            │  Express + Prisma      │                          │ Nginx + React SPA │
            │  ├── /api/v1/*         │                          │ (Vite build)      │
            │  ├── /api/platform/*   │                          └──────────────────┘
            │  ├── /api/nfc/*        │
            │  └── /api/health       │
            │                        │
            │  Middleware:            │
            │  ├── JWT auth          │
            │  ├── CSRF protection   │
            │  ├── Tenant context    │
            │  ├── Device auth       │
            │  ├── Rate limiting     │
            │  ├── XSS sanitize      │
            │  └── Helmet            │
            └───────┬──────┬─────────┘
                    │      │
          ┌─────────┘      └──────────┐
          ▼                           ▼
┌──────────────────┐       ┌───────────────────┐
│ Docker: postgres │       │  Docker: redis    │
│ PostgreSQL 16    │       │  Redis 7          │
│                  │       │                   │
│ 31 Prisma models │       │ ├── Session cache │
│ Shared-DB multi- │       │ ├── BullMQ queues │
│ tenancy (orgId)  │       │ └── Pub/Sub (SSE) │
│                  │       │                   │
│ Vol: pg-data     │       │ Vol: redis-data   │
└──────────────────┘       └────────┬──────────┘
                                    │
                           ┌────────┘
                           ▼
                ┌───────────────────┐
                │ Docker: worker    │
                │                   │
                │ BullMQ Workers:   │
                │ ├── Email queue   │
                │ ├── Push notif    │
                │ └── Scheduler     │
                │   (forgot-checkout│
                │    trial-expiry)  │
                └───────────────────┘

                ┌───────────────────┐
                │ Docker: backup    │
                │                   │
                │ Cron: 2 AM UTC    │
                │ pg_dump → gzip    │
                │ 30-day retention  │
                │                   │
                │ Vol: backup-data  │
                └───────────────────┘
```

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Docker Network: internal (bridge)                                  │
│                                                                     │
│  ┌──────────┐  ┌───────┐  ┌─────┐  ┌────────┐  ┌─────┐  ┌──────┐ │
│  │ postgres │  │ redis │  │ api │  │ worker │  │ web │  │backup│ │
│  │ :5432    │  │ :6379 │  │:3001│  │  (bg)  │  │ :80 │  │(cron)│ │
│  └──────────┘  └───────┘  └──┬──┘  └────────┘  └──┬──┘  └──────┘ │
│                               │                    │               │
└───────────────────────────────┼────────────────────┼───────────────┘
                                │                    │
                    Host port 127.0.0.1:3001    Host port 127.0.0.1:8080
                                │                    │
                    ┌───────────┴────────────────────┴──────────────┐
                    │         Host: Nginx (port 80/443)             │
                    │         Public-facing reverse proxy            │
                    └──────────────────────────────────────────────┘
```

All Docker services communicate on the `internal` bridge network. Only `api` (:3001) and `web` (:8080) bind to the host loopback. The host Nginx is the sole public entry point.

---

## Data Flow

### Employee Check-In (Web/Mobile)

```
Browser/App ──POST /api/v1/attendance/check-in──► Nginx ──► API
  │                                                          │
  │  ◄── 200 { attendance record } ──────────────────────────┘
  │                                                          │
  │                                           API ──► PostgreSQL (INSERT)
  │                                           API ──► Redis PUB (SSE event)
  │                                           API ──► BullMQ (push notification)
```

### NFC Tap (On-Premise Reader)

```
NFC Reader (office) ──POST /api/nfc/tap──► Nginx (HTTPS) ──► API
  │                                                           │
  │  ◄── 200 { action: "check_in", employee } ───────────────┘
  │                                                           │
  │                                            API ──► PostgreSQL (attendance + tap log)
  │                                            API ──► Redis PUB (SSE → admin dashboard)
```

### NFC Heartbeat (On-Premise Reader)

```
NFC Reader ──POST /api/nfc/heartbeat──► API ──► PostgreSQL (UPDATE device.lastHeartbeatAt)
  (every 10s)                                    │
                                                 └──► Reader Status page shows online/offline
```

### Background Worker

```
API ──enqueue──► Redis (BullMQ) ──► Worker
                                      ├── Email worker: SMTP → employee/admin
                                      ├── Push worker: Expo Push → mobile devices
                                      └── Scheduler:
                                            ├── Forgot-checkout reminders
                                            └── Trial expiry processing
```

---

## Authentication Flows

### User Authentication (JWT)

```
POST /api/v1/auth/login
  │
  ├── Validates email + password (bcrypt-12)
  ├── Returns: accessToken (15min) + refreshToken (httpOnly cookie, 7d)
  └── Tenant context set via orgId from employee record

POST /api/v1/auth/refresh
  │
  └── Rotates refresh token, issues new access token
```

### Platform Admin Authentication

```
POST /api/platform/auth/login
  │
  ├── Validates against PlatformUser table
  └── Returns: accessToken + refreshToken (same JWT flow, different table)
```

### Device Authentication (API Key)

```
POST /api/nfc/tap
Headers:
  X-Device-Serial: NFC-RECEPTION-01
  X-Api-Key: dev_xxxxxxxxxxxxxxxx
  │
  ├── deviceAuth middleware: lookup Device by serial + verify key (bcrypt)
  ├── Sets req.device and req.orgId from device record
  └── Proceeds to route handler (no JWT needed)
```

---

## Multi-Tenancy Model

```
┌──────────────────────────────────────────────────────────────────┐
│                     PostgreSQL (single instance)                  │
│                                                                  │
│  ┌──────────────────────┐     ┌──────────────────────┐          │
│  │ Platform Tables       │     │ Org-Scoped Tables     │          │
│  │ (no orgId)            │     │ (filtered by orgId)   │          │
│  │                       │     │                       │          │
│  │ ├── PlatformUser      │     │ ├── Employee          │          │
│  │ ├── Organization      │     │ ├── Attendance        │          │
│  │ ├── Plan              │     │ ├── Leave             │          │
│  │ ├── Invoice           │     │ ├── Device            │          │
│  │ ├── Module            │     │ ├── NfcCard (via emp) │          │
│  │ └── AppRelease        │     │ ├── Branch            │          │
│  │                       │     │ ├── Holiday           │          │
│  └──────────────────────┘     │ ├── Notice            │          │
│                                │ ├── OrgSetting        │          │
│                                │ ├── Shift             │          │
│                                │ ├── Role              │          │
│                                │ └── ... (31 total)    │          │
│                                └──────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘

Tenant isolation: tenantContext middleware injects orgId from JWT into
every request. All queries include WHERE orgId = req.orgId.
```

---

## On-Premise Device Connectivity

```
┌─────────────────────┐     ┌─────────────────────┐
│  Office A            │     │  Office B            │
│                      │     │                      │
│  ┌────────────────┐  │     │  ┌────────────────┐  │
│  │ PC + ACR122U   │  │     │  │ PC + ACR122U   │  │
│  │ nfc-reader/    │  │     │  │ nfc-reader/    │  │
│  │                │  │     │  │                │  │
│  │ Serial:        │  │     │  │ Serial:        │  │
│  │ NFC-OFFICE-A   │  │     │  │ NFC-OFFICE-B   │  │
│  └───────┬────────┘  │     │  └───────┬────────┘  │
│          │           │     │          │           │
└──────────┼───────────┘     └──────────┼───────────┘
           │  HTTPS (outbound)          │  HTTPS (outbound)
           │                            │
           ▼                            ▼
    ┌──────────────────────────────────────────┐
    │         Cloud Server (yourdomain.com)     │
    │                                          │
    │  API validates:                          │
    │  ├── X-Device-Serial → Device lookup     │
    │  ├── X-Api-Key → bcrypt verify           │
    │  ├── Device.isActive must be true        │
    │  └── orgId inherited from Device record  │
    │                                          │
    │  Platform Admin manages all devices:     │
    │  ├── Register / deactivate / reactivate  │
    │  ├── Rotate API keys                     │
    │  └── View status across all orgs         │
    │                                          │
    │  Org Admin sees their own readers:       │
    │  ├── NFC Management → Reader Status tab  │
    │  ├── Tap Log tab (daily history)         │
    │  └── Write Jobs tab (card provisioning)  │
    └──────────────────────────────────────────┘
```

---

## Port Map

| Service | Container Port | Host Binding | Public |
|---------|---------------|--------------|--------|
| PostgreSQL | 5432 | 127.0.0.1:5433 | No |
| Redis | 6379 | 127.0.0.1:6379 | No |
| API | 3001 | 127.0.0.1:3001 | No |
| Web (Docker Nginx) | 80 | 127.0.0.1:8080 | No |
| Host Nginx | 80, 443 | 0.0.0.0 | **Yes** |
| Worker | — | — | No |
| Backup | — | — | No |

Only the host Nginx (port 80/443) is exposed to the internet. All Docker services bind to loopback only.

---

## Volume Map

| Volume | Purpose | Backup |
|--------|---------|--------|
| `pg-data` | PostgreSQL data directory | Daily via backup service |
| `redis-data` | Redis RDB persistence | Not backed up (cache/queue, reconstructible) |
| `app-data` | APK uploads, branding assets | Include in file-level backup |
| `backup-data` | Database backup archives | Offsite sync recommended |

---

## Security Layers

| Layer | Implementation |
|-------|---------------|
| **Transport** | TLS 1.2+ via Let's Encrypt (Nginx) |
| **Headers** | Helmet (X-Frame-Options, CSP, HSTS, etc.) |
| **Auth** | JWT access/refresh tokens, bcrypt-12 passwords |
| **CSRF** | Double-submit cookie pattern |
| **Rate Limiting** | 30 req/15min on auth, 500 req/15min on API |
| **Input** | XSS sanitization middleware, 1MB body limit |
| **Tenant Isolation** | orgId injected from JWT, enforced in all queries |
| **Device Auth** | Per-device API keys (bcrypt hashed), serial verification |
| **Network** | Docker services on internal bridge, loopback-only host bindings |
| **Secrets** | Environment variables, never committed to repo |
