# Infrastructure — System Architecture

Detailed view of the Archisys platform infrastructure, service topology, and data flow.

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
                            │   /api/*  ──►  127.0.0.1:8080 (Web Nginx container) │
                            │   /*      ──►  127.0.0.1:8080 (Web Nginx container) │
                            └─────────────────────────┬───────────────────────────┘
                                                      │
                                                      ▼
                            ┌─────────────────────────────────────────────────────┐
                            │         Docker: web (:80) — Nginx + React SPA       │
                            │                                                      │
                            │   /api/(v1/)?accounting|billing  ──► accounting:3010 │
                            │   /api/(v1/)?crm                 ──► crm:3011       │
                            │   /api/*                         ──► api:3001       │
                            │   /*                             ──► React SPA      │
                            └────────┬───────────────┬────────────────┬───────────┘
                                     │               │                │
                    ┌────────────────┘               │                └────────────────┐
                    ▼                                ▼                                 ▼
       ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────────────┐
       │   Docker: api (:3001)  │  │ Docker: accounting     │  │   Docker: crm (:3011)      │
       │                        │  │         (:3010)         │  │                            │
       │  Express + Prisma      │  │ Express + Prisma        │  │  Express + Prisma          │
       │  ├── /api/v1/*         │  │ ├── /api/v1/accounting  │  │  ├── /api/v1/crm/*         │
       │  ├── /api/platform/*   │  │ ├── /api/v1/billing     │  │  │   Pipelines, Clients    │
       │  ├── /api/nfc/*        │  │ └── Journals, Ledger,   │  │  │   Leads, Deals          │
       │  └── /api/health       │  │     Trial Balance, P&L  │  │  │   Activities, Campaigns │
       │                        │  │                         │  │  └── /api/health           │
       │  Modules:              │  └────────────┬────────────┘  └──────────────┬─────────────┘
       │  ├── Auth & RBAC       │               │                              │
       │  ├── Attendance        │               │                              │
       │  ├── Leaves            │               │                              │
       │  ├── Payroll           │               │                              │
       │  ├── HRM              │               │                              │
       │  ├── Performance       │               │                              │
       │  ├── Recruitment       │               │                              │
       │  ├── Training          │               │                              │
       │  ├── NFC / Devices     │               │                              │
       │  ├── Notifications     │               │                              │
       │  └── Settings          │               │                              │
       └───────┬──────┬─────────┘               │                              │
               │      │                         │                              │
     ┌─────────┘      └─────────────────────────┼──────────────────────────────┘
     ▼                                          ▼
┌──────────────────┐                  ┌───────────────────┐
│ Docker: postgres │                  │  Docker: redis    │
│ PostgreSQL 16    │                  │  Redis 7          │
│                  │                  │                   │
│ 12 schemas:      │                  │ ├── Session cache │
│ ├── core         │                  │ ├── BullMQ queues │
│ ├── attendance   │                  │ ├── Pub/Sub (SSE) │
│ ├── payroll      │                  │ └── Event bus     │
│ ├── crm          │                  │                   │
│ ├── accounting   │                  │ Vol: redis-data   │
│ ├── billing      │                  └────────┬──────────┘
│ ├── hrm          │                           │
│ ├── performance  │                  ┌────────┘
│ ├── devices      │                  ▼
│ ├── platform     │       ┌────────────────────────────┐
│ ├── recruitment  │       │ Docker: worker             │
│ └── training-ess │       │                            │
│                  │       │ 6 BullMQ Queues:           │
│ 96 models total  │       │ ├── email (SMTP send)      │
│                  │       │ ├── push (Expo Push)       │
│ Vol: pg-data     │       │ ├── campaign (dispatch +   │
└──────────────────┘       │ │   lead scoring)          │
                           │ ├── report (async CSV)     │
                           │ ├── payroll (async gen)    │
                           │ └── scheduler (15 cron)    │
                           │                            │
                           │ Vol: app-data (shared)     │
                           └────────────────────────────┘

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
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Docker Network: internal (bridge)                                               │
│                                                                                  │
│  ┌────────┐ ┌─────┐ ┌─────┐ ┌──────────┐ ┌─────┐ ┌─────┐ ┌──────┐ ┌────────┐ │
│  │postgres│ │redis│ │ api │ │accounting│ │ crm │ │ web │ │worker│ │ backup │ │
│  │ :5432  │ │:6379│ │:3001│ │  :3010   │ │:3011│ │ :80 │ │ (bg) │ │ (cron) │ │
│  └────────┘ └─────┘ └──┬──┘ └────┬─────┘ └──┬──┘ └──┬──┘ └──────┘ └────────┘ │
│                         │         │           │       │                          │
└─────────────────────────┼─────────┼───────────┼───────┼──────────────────────────┘
                          │         │           │       │
              Host port :3001   Host :3010  Host :3011  Host port :8080
                          │         │           │       │
                    ┌─────┴─────────┴───────────┴───────┴──────────────┐
                    │         Host: Nginx (port 80/443)                 │
                    │         Public-facing reverse proxy                │
                    └──────────────────────────────────────────────────┘
```

All Docker services communicate on the `internal` bridge network. The `web` container acts as the internal reverse proxy, routing API requests to the appropriate microservice. The host Nginx handles SSL termination and is the sole public entry point.

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

### Background Worker (6 Queues, 15 Cron Jobs)

```
API ──enqueue──► Redis (BullMQ) ──► Worker Process
                                      │
                                      ├── Email queue
                                      │   └── SMTP send (org-specific or env config, 3 retries)
                                      │
                                      ├── Push queue
                                      │   ├── send-push → Expo Push API → mobile devices
                                      │   └── send-push-admins → all org admins
                                      │
                                      ├── Campaign queue
                                      │   ├── dispatch-campaign-emails → batch send to members
                                      │   │   (personalization: {{name}}, {{email}})
                                      │   │   Updates sentCount/deliveredCount per batch
                                      │   └── calculate-lead-scores → status + campaign engagement
                                      │
                                      ├── Report queue
                                      │   └── generate-report → CSV file → app-data volume
                                      │       Types: attendance-summary, attendance-export,
                                      │       payroll-export, leave-report, late-arrivals,
                                      │       department-summary
                                      │       Notifies requester when complete
                                      │
                                      ├── Payroll queue
                                      │   └── generate-payroll → async computation
                                      │       Notifies admin on success/failure
                                      │
                                      └── Scheduler (15 repeatable cron jobs)
                                            ├── finalize-attendance     (daily 23:55 NPT)
                                            ├── check-trial-expiry      (daily 00:00 NPT)
                                            ├── leave-accrual           (monthly 1st)
                                            ├── leave-carryover         (yearly Jan 1)
                                            ├── device-health-check     (every 2 min)
                                            ├── calculate-incentives    (monthly 1st 01:00)
                                            ├── check-probation-expiry  (daily 00:30 NPT)
                                            ├── activity-reminders      (every 30 min)
                                            ├── birthday-anniversary    (daily 07:00 NPT)
                                            ├── attendance-anomaly      (daily 06:00 NPT)
                                            ├── database-cleanup        (weekly Sunday)
                                            ├── invoice-auto-generation (monthly 1st)
                                            ├── backup-verification     (weekly Sunday)
                                            ├── campaign-analytics      (daily 23:30 NPT)
                                            └── document-expiry-alerts  (daily 08:00 NPT)
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
│  ┌──────────────────────┐     ┌──────────────────────────────┐  │
│  │ Platform Tables       │     │ Org-Scoped Tables             │  │
│  │ (no orgId)            │     │ (filtered by orgId)           │  │
│  │                       │     │                               │  │
│  │ ├── PlatformUser      │     │ core: Employee, Organization, │  │
│  │ ├── Organization      │     │   Role, Branch, OrgSetting…  │  │
│  │ ├── Plan              │     │ attendance: Attendance,       │  │
│  │ ├── Invoice           │     │   Leave, Correction, QR…     │  │
│  │ ├── Module            │     │ payroll: SalaryStructure,     │  │
│  │ └── AppRelease        │     │   Payslip, Bonus, Incentive… │  │
│  │                       │     │ crm: Pipeline, Client, Lead,  │  │
│  └──────────────────────┘     │   Deal, Activity, Campaign…  │  │
│                                │ accounting: Account, Journal, │  │
│                                │   JournalEntry…              │  │
│                                │ billing: Invoice, Payment…    │  │
│                                │ hrm: Document, Policy,        │  │
│                                │   Separation, Clearance…     │  │
│                                │ performance: KPI, Review…     │  │
│                                │ recruitment: Job, Applicant…  │  │
│                                │ training: Session, Cert…      │  │
│                                │ devices: Device, NfcCard…     │  │
│                                │                               │  │
│                                │ 96 models across 12 schemas   │  │
│                                └──────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

Tenant isolation: tenantContext middleware injects orgId from JWT into
every request. All queries include WHERE orgId = req.orgId.
Microservices share the same database and verify JWT independently.
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

## Microservice Communication

```
┌─────────────────────────────────────────────────────────────────────┐
│  Web Container (Nginx) — Internal Reverse Proxy                     │
│                                                                     │
│  Route Rules:                                                       │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  /api/(v1/)?(accounting|billing)  ──► http://accounting:3010  │  │
│  │  /api/(v1/)?crm                   ──► http://crm:3011        │  │
│  │  /api/*                           ──► http://api:3001        │  │
│  │  /*                               ──► React SPA (static)     │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  All microservices:                                                 │
│  ├── Share the same PostgreSQL database (different schemas)         │
│  ├── Share the same Redis instance (event bus pub/sub)              │
│  ├── Verify JWT independently (same JWT_SECRET)                     │
│  └── Have independent health checks and restart policies            │
└─────────────────────────────────────────────────────────────────────┘
```

### CRM Campaign Flow

```
Admin creates Campaign (type: TELEMARKETING | EMAIL | DIGITAL | SOCIAL | ...)
  │
  ├── POST /api/v1/crm/campaigns ──► CRM service ──► PostgreSQL (crm.crm_campaigns)
  │
  ├── Add members (contacts to target)
  │   POST /api/v1/crm/campaigns/:id/members
  │   └── PostgreSQL (crm.crm_campaign_members)
  │
  ├── Dispatch emails to all targeted members
  │   POST /api/v1/crm/campaigns/:id/dispatch { subject, html }
  │   └── Enqueues to Campaign queue ──► Worker batch-sends with personalization
  │       ├── Updates member status: TARGETED → SENT
  │       ├── Updates campaign sentCount/deliveredCount
  │       └── Emails routed through Email queue for retry resilience
  │
  ├── Trigger lead scoring
  │   POST /api/v1/crm/campaigns/:id/score-leads
  │   └── Worker recalculates scores (status + campaign conversion rate)
  │       Score: NEW=10, CONTACTED=25, QUALIFIED=40, CONVERTED=60, high-conv campaign +20
  │
  ├── Track funnel metrics (manual or auto from dispatch)
  │   PUT /api/v1/crm/campaigns/:id  { sentCount, openedCount, ... }
  │
  ├── Generated leads link back to campaign
  │   POST /api/v1/crm/leads  { campaignId: "..." }
  │
  ├── Nightly analytics snapshot (scheduler job)
  │   └── Captures ROI, funnel metrics, lead/member counts → stored in campaign tags
  │
  └── Campaign stats aggregated via GET /api/v1/crm/campaigns/stats
      └── ROI, conversion rate, by type/status breakdown
```

---

## Port Map

| Service | Container Port | Host Binding | Public |
|---------|---------------|--------------|--------|
| PostgreSQL | 5432 | 127.0.0.1:5433 | No |
| Redis | 6379 | 127.0.0.1:6379 | No |
| API (main) | 3001 | 127.0.0.1:3001 | No |
| Accounting | 3010 | 127.0.0.1:3010 | No |
| CRM | 3011 | 127.0.0.1:3011 | No |
| Web (Docker Nginx) | 80 | 127.0.0.1:8080 | No |
| Host Nginx | 80, 443 | 0.0.0.0 | **Yes** |
| Worker | — | — | No |
| Backup | — | — | No |

Only the host Nginx (port 80/443) is exposed to the internet. All Docker services bind to loopback only. The `web` container's internal Nginx handles routing between microservices based on URL prefix.

---

## Volume Map

| Volume | Purpose | Backup |
|--------|---------|--------|
| `pg-data` | PostgreSQL data directory | Daily via backup service |
| `redis-data` | Redis RDB persistence | Not backed up (cache/queue, reconstructible) |
| `app-data` | APK uploads, branding assets, generated reports | Include in file-level backup |
| `backup-data` | Database backup archives | Offsite sync recommended |

> Note: `app-data` is shared between `api` and `worker` containers so generated report files are accessible for download via the API.

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
