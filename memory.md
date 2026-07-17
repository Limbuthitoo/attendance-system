# Project Memory: Archisys Attendance

Last studied: 2026-07-17

This file is a working reference for future Codex sessions. Treat source files as the source of truth when code and this memory differ.

## Big Picture

Archisys Attendance is a multi-tenant HR and business SaaS with four main local parts:

- `server/`: Node.js 20 + Express API, Prisma 6, PostgreSQL, Redis, BullMQ workers, platform admin API, and extracted microservice entrypoints.
- `web/`: React 18 + Vite + Tailwind admin/dashboard SPA, including a separate platform portal under `/platform`.
- `mobile/`: Expo SDK 54 / React Native employee/admin mobile app.
- `nfc-reader/`: on-premise Node.js PC/SC client for ACR122U-style NFC readers using `nfc-pcsc`.

Production is Docker Compose based: `postgres`, `redis`, `api`, `worker`, `accounting`, `crm`, `web`, and `backup`. The `web` container serves the SPA and internally proxies API traffic to the right backend service.

Current code posture after the 2026-06-17 audit/fix pass:

- Mobile auth/employee/notification API methods are aligned with server routes.
- Server keeps compatibility routes for notification read operations and notice detail.
- Password recovery now uses hashed, single-use `PasswordResetToken` rows and public `/forgot-password` + `/reset-password` web screens.
- Platform organization detail can send reset links to specific active org admins.
- Local Vite proxy now splits CRM/accounting traffic to `3011`/`3010`, matching production Nginx routing.
- Accounting and CRM microservice entrypoints use sanitize + CSRF middleware like the main API.
- HR route gates use `hr_manager` consistently, not the legacy `hr` role name.
- Selected tenant/platform write routes now have stronger role gates.
- Docker startup no longer runs `prisma db push --accept-data-loss`; migrations are a deploy step.
- Compose and backup scripts require explicit DB/Redis secrets instead of known fallback passwords.

Current code posture after the 2026-07-17 employee/RBAC synchronization pass:

- Employee create/edit uses the organization department/designation hierarchy returned by the API; the server catalog is the single source of truth.
- Employee tables display actual assigned role names rather than only the legacy `admin`/`employee` compatibility label.
- Web and mobile administrative navigation use permission keys from the authenticated user payload.
- Tenant API guards for employees, attendance, leave, reports, payroll, settings, devices/NFC, departments/designations, and related modules use canonical permissions instead of fixed role names where a permission exists.
- Role creation, editing, assignment, removal, and employee role replacement prevent granting permissions above the actor's own authority. System roles are platform-managed and immutable to tenant administrators.
- Authorization denials and blocked privilege-escalation attempts are audit logged. Users with `audit.view` can see security/admin events in Activity Log.
- Assignment and NFC write-job paths validate tenant ownership to prevent cross-organization ID use.
- A small set of highly sensitive features without dedicated permission keys remains explicitly `org_admin` only: password reset/unlock, policy administration, and app-release administration.

## Repository Shape

Important root files:

- `README.md`: high-level architecture, quick start, modules, API overview.
- `INFRASTRUCTURE.md`: topology, data flow, auth/device flow, worker queues.
- `HOSTING.md`: VPS, Docker, SSL, webhook, backup, NFC, mobile distribution notes.
- `docker-compose.yml`: production-ish service orchestration.
- `deploy.sh`: deployment script.
- `webhook.js`: GitHub webhook deploy listener.
- `memory.md`: this file.

Current notable worktree state when created:

- `mobile/app.json` was already modified before this memory file was added: version changed from `2.1.2` to `2.2.0`. Do not revert unless the user asks.

## Backend

Backend package:

- Path: `server/package.json`
- Scripts: `npm start`, `npm run dev`, `npm run worker`, `npm run worker:dev`, Prisma generate/migrate/seed/studio helpers.
- Main dependencies: Express, Prisma, JWT, bcryptjs, BullMQ, ioredis, nodemailer, multer, helmet, cors, compression, rate limiting, cookie parser, xss.
- No test script is defined.

Main entrypoints:

- `server/src/index.js`: main API process on `PORT` default `3001`.
- `server/src/accounting-service.js`: accounting + billing microservice on default `3010`.
- `server/src/crm-service.js`: CRM microservice on default `3011`.
- `server/src/workers/index.js`: BullMQ worker process.

Main API wiring in `server/src/index.js`:

- Creates `server/data/apk` and `server/data/branding`.
- Uses Helmet, compression, Morgan, cookie parser, JSON body parsing, XSS sanitization, CSRF token set/validation, CORS, rate limits.
- Health check: `GET /api/health`.
- Public branding routes mounted at `/api/v1/settings/branding/:type` and `/api/settings/branding/:type`.
- NFC router mounted before general limiter at `/api/v1/nfc` and `/api/nfc`.
- Main tenant API mounted at `/api/v1`.
- Platform admin API mounted at `/api/platform`.
- Backward-compatible tenant routes mounted at `/api/*` for old clients, skipping `/api/v1`, `/api/platform`, and `/api/health`.

Backend config:

- `server/src/config/index.js` loads `.env`.
- Required: `DATABASE_URL`, `JWT_SECRET`.
- Defaults: `PORT=3001`, `NODE_ENV=development`, `REDIS_URL=redis://localhost:6379`, access token `2h`, refresh token `7d`.
- Production requires `CORS_ORIGIN`; otherwise cross-origin requests are rejected.
- Avoid copying secret-looking values from `.env.example` into docs or output.

Auth and tenancy:

- `server/src/middleware/auth.js`: employee JWT auth via bearer token, `access_token` cookie, or `?token=` SSE fallback. Rejects refresh tokens used as access tokens. Caches user data briefly via `middleware/cache`.
- User role is still flattened to `admin`/`employee` for backward compatibility, but `roles` and the unioned `permissions` array are authoritative for access control and are returned immediately at login and `/auth/me`.
- `tenantContext` sets `req.orgId` from `req.user.orgId` or `req.device.orgId`.
- `moduleGuard.requireModule(...)` checks active `OrgModule` records, with 60s in-memory cache.
- Platform auth is separate in `server/src/middleware/platformAuth.js`.
- Device routes use `server/src/middleware/deviceAuth.js` where applicable.

Tenant route index:

- `server/src/routes/v1/index.js` mounts public `/auth`.
- Protected tenant routes usually use `authenticate`, `tenantContext`, then optional `requireModule`.
- Main mounted groups include attendance, leaves, employees, dashboard, devices, settings, holidays, notices, notifications, branches, roles, QR, reports, overtime, geofence, payroll, incentives, performance, tasks, projects, referrals, bonuses, departments, designations, tax config, festival advances, recruitment, onboarding, separation, training, ESS, compensation, org chart, NFC, policies, app update.
- Accounting + billing routes exist under `server/src/routes/v1/`, but are intentionally served by `accounting-service.js`.
- CRM route exists under `server/src/routes/v1/crm.js`, but is intentionally served by `crm-service.js`.

Platform route index:

- `server/src/routes/platform/index.js` mounts `/auth` public.
- Protected platform routes require `authenticatePlatform`.
- Groups: organizations, modules, plans, billing, users, dashboard, app update, devices, device catalog, settings.

Module loader:

- `server/src/modules/index.js` loads `core`, `attendance`, `payroll`, `performance`, and `hrm`.
- Accounting, billing, and CRM modules still have module index files, but are commented as extracted to microservices.
- `initModules()` is called at main API startup mainly to trigger service imports/event subscriptions and expose metadata.

Event/queue layer:

- `server/src/lib/eventBus.js`: Redis pub/sub-backed event bus with in-process fallback. Single Redis channel `eventbus`. Functions in event data are held locally by correlation ID, so callbacks only work inside the same process.
- `server/src/config/queue.js`: BullMQ queues: `email`, `push`, `scheduler`, `campaign`, `report`, `payroll`.
- Queue helpers include email, push, admin push, campaign dispatch/scoring, report generation, payroll generation.

Prisma/database:

- Schema path: `server/prisma/schema.prisma`.
- PostgreSQL datasource.
- The current Prisma setup is a single schema file with tenant isolation through `orgId`. Do not describe it as Prisma multi-schema unless the code is actually migrated to `@@schema` / `multiSchema`.
- Models cover platform, organization/tenant, employees/RBAC, branches, shifts/schedules, device catalog/devices/NFC, attendance, leave, notifications, app releases, audit logs, payroll/overtime/tax/benefits, incentives/bonuses, performance, recruitment/onboarding/referrals/training/ESS/separation, CRM, accounting, billing, projects/tasks, leave balances.
- Password recovery model: `PasswordResetToken`, mapped to `password_reset_tokens`.
- Department/designation model: `Designation` has optional `departmentId`, allowing organization departments to own their own designation lists while employee records still store department/designation names for compatibility. The canonical defaults live only in `server/src/config/default-org-structure.js`, are seeded into every organization, and are also returned by the department API for web/mobile fallback rendering.
- Department/designation access is permission based: writes require `department.manage` or `designation.manage`; update/delete operations verify tenant ownership before mutation.
- The canonical permission catalog lives in `server/src/config/permissions.js`. System role templates live in `server/src/seed.js`; `org_admin` is seeded with the complete catalog. Defaults include `org_admin`, `hr_manager`, `finance_manager`, `accountant`, `payroll_manager`, `recruiter`, `training_manager`, `operations_manager`, `department_head`, `project_manager`, `sales_manager`, `it_admin`, `branch_manager`, `team_lead`, and `employee`.
- Permissions from multiple assigned roles are unioned. Role management requires `role.manage`; a manager may grant only permissions already present in their own effective permission set. Tenant users cannot modify globally shared system roles.
- HR lifecycle and compensation writes are permission-gated as of the form audit: recruitment uses `recruitment.manage`, onboarding uses `onboarding.manage`, training uses `training.manage`, separation uses `separation.manage`, compensation uses `compensation.manage`, and employee list/detail uses `employee.view`. The web app route guard/sidebar also honors permissions so specialist roles such as `recruiter`, `training_manager`, and `finance_manager` can reach their pages without needing the `hr_manager` role name.
- Recruitment form fixes: applicants must select a job posting, interviews have a real scheduling form with applicant/interviewer/time/type fields, and job cards read `vacancies` from the API. Training course duration is numeric hours. Compensation benefit and salary revision fields now match API/schema names. Separation and compensation salary revision forms use employee dropdowns instead of raw employee UUID inputs.
- Every tenant-scoped model should be queried with `orgId` isolation.
- Migrations live in `server/prisma/migrations`.
- Local database audit showed migration-history drift: migrations exist in the repo but the local database did not record them as applied while tables already existed. Reconcile that before treating the local DB as production-like.

Services:

- Business logic is mostly in `server/src/services/*.service.js`.
- Shared helpers include `attendance-helpers.js`, `payroll-engine.service.js`, `attendance-correction.service.js`.
- Adapters for device/input types live in `server/src/adapters`: base, NFC, QR, fingerprint, face.

## Web App

Web package:

- Path: `web/package.json`
- Scripts: `npm run dev`, `npm run build`, `npm run preview`.
- Stack: React 18, Vite, React Router, Tailwind, Lucide icons, Recharts.
- No test script is defined.

Entrypoints:

- `web/src/main.jsx`: React app bootstrap.
- `web/src/App.jsx`: route tree, lazy page loading, permission-aware protected routes, platform portal routing.
- `web/src/components/Layout.jsx`: main org dashboard shell.
- `web/src/platform/PlatformLayout.jsx`: platform shell.

API client:

- `web/src/lib/api/client.js` sets `API_BASE` to `${VITE_API_URL}/api` when `VITE_API_URL` exists, else `/api`.
- Stores access token and refresh token in `localStorage`.
- Sends bearer token and `X-CSRF-Token` from `csrf_token` cookie.
- On 401, performs refresh-token rotation once and retries.
- Supports `options.params` query serialization and raw response mode for downloads/exports.
- `web/src/lib/api/index.js` composes domain modules and exports a backward-compatible `api` object.
- `web/src/lib/api.js` is a thin re-export.

Routing:

- `/login` is org login.
- `/platform/login` and `/platform/*` are wrapped in `PlatformAuthProvider`.
- Org routes under `/` are wrapped in `ProtectedRoute` and `Layout`.
- `AdminRoute` accepts permission alternatives and allows either the legacy organization-admin compatibility role or a matching effective permission.
- Sidebar visibility, route guards, and backend APIs are aligned for specialist roles such as HR, finance, recruitment, training, operations, CRM, payroll, and device management.

Vite/proxy:

- `web/vite.config.js` dev server is `5173`.
- Dev proxy sends accounting/billing API traffic to `http://127.0.0.1:3010`, CRM traffic to `http://127.0.0.1:3011`, and remaining `/api` traffic to `http://127.0.0.1:3001`.
- For local CRM/accounting pages, run the extracted services in addition to the main API.
- Production split is in `web/nginx.conf` and should stay aligned with Vite proxy rules.

Production web nginx:

- Proxies `/api/(v1/)?(accounting|billing)` to `accounting:3010`.
- Proxies `/api/(v1/)?crm` to `crm:3011`.
- Proxies `/api/nfc/events` to `api:3001` with buffering disabled for SSE.
- Proxies remaining `/api/` to `api:3001`.
- Serves SPA with `try_files ... /index.html`.

## Mobile App

Mobile package:

- Path: `mobile/package.json`
- Expo SDK 54, React 19.1, React Native 0.81.5.
- Scripts: `npm start`, `npm run android`, `npm run ios`, `npm run web`.
- Uses React Navigation native stack and bottom tabs, Expo SecureStore, notifications, location, device, constants.
- No test script is defined.

Expo config:

- Path: `mobile/app.json`.
- Name: `Archisys Attendance`.
- Slug: `archisys-attendance`.
- Current observed version: `2.2.0`.
- Package/bundle ID: `com.archisys.attendance`.
- `extra.apiUrl`: `https://hr.bijaysubbalimbu.com.np/api`.
- Uses `google-services.json`.
- Plugins include secure store, asset, font, notifications, build properties, local `./plugins/withAbiFilter`, datetime picker.
- Android release build properties enable ProGuard/resource shrink and build only `arm64-v8a`.

Entrypoints:

- `mobile/App.js`: navigation tree, notification response handling, lazy-loaded screens, update checker.
- `mobile/src/context/AuthContext.js`: SecureStore token load/login/logout, push token registration/unregistration.
- `mobile/src/api/client.js`: base URL from `Constants.expoConfig.extra.apiUrl`, fallback `http://192.168.1.3:3001/api`; SecureStore bearer tokens; refresh on 401.
- `mobile/src/api/index.js` composes mobile domain APIs.
- `mobile/src/api.js` is a thin re-export.
- Current mobile/server contract notes:
  - Password change uses `POST /auth/change-password`.
  - Admin reset uses `POST /employees/:id/reset-password` with `{ newPassword }`.
  - Notification list uses `unreadOnly=true`; server also accepts legacy `unread_only=true` and `unread_only=1`.
  - Single notification read uses `PUT /notifications/read` with `{ ids: [id] }`.
  - All notification read uses `PUT /notifications/read-all`.
  - Notice detail uses `GET /notices/:id`.

Password reset flow:

- Public request endpoint: `POST /api/auth/forgot-password`.
- Public token verification: `POST /api/auth/reset-password/verify`.
- Public password update: `POST /api/auth/reset-password/confirm`.
- Platform assisted reset: `POST /api/platform/organizations/:id/admin-password-reset-link`, optionally with `{ employeeId }`.
- Reset email links use `WEB_APP_URL` / `APP_URL`, falling back to request origin.
- In development, the platform reset endpoint returns `resetLink`; production omits the raw link.
- Confirming a reset clears failed attempts/lockout, sets `mustChangePassword=false`, invalidates auth cache, revokes refresh tokens, and marks outstanding reset tokens revoked.

Navigation:

- Logged-out users see `LoginScreen`.
- Logged-in users with `must_change_password` see `ChangePasswordScreen`.
- Main tabs: Home, My Attendance, Leaves, Calendar, More.
- More stack contains notifications, notices, policies, notification settings, QR check-in, profile/change password. Leave requests, employees, and team attendance are exposed according to `leave.*`, `employee.view`, and `attendance.view_all` permissions rather than the legacy admin label.
- Mobile employee creation loads departments/designations from the same server-owned structure as web, applies department-to-designation filtering, and creates standard Employee access only; elevated role assignment remains in secured web Role Management.

## RBAC and Audit Invariants

- Designation is a job title and never grants application access. Role assignments grant permissions.
- Backend permission middleware is the security boundary; hiding a web/mobile control is only a usability layer.
- `requirePermission` requires all supplied permissions; `requireAnyPermission` accepts any supplied permission. Both audit authenticated denials.
- Successful role changes invalidate the affected user's auth cache. Existing sessions should re-login after role-template changes to refresh client-visible permissions immediately.
- `security.access_denied` and `security.privilege_escalation_blocked` events include actor, organization, path/operation, IP, user agent, and required/excessive access where applicable.
- Activity Log includes audit/security events only for users with `audit.view`; ordinary employees remain scoped to their own operational activity.
- System-role permission changes are made through the platform seed/code path, not tenant Role Management. Run the idempotent seed after changing system role templates so existing databases are backfilled.

## Verified Checks (2026-07-17)

- All `server/src/**/*.js` files pass `node --check`.
- The v1 route tree loads successfully with validation environment variables.
- Every permission used by `requirePermission`/`requireAnyPermission` exists in the canonical permission catalog.
- Prisma schema validation passes.
- Web production build passes.
- Changed mobile files parse successfully with Babel's parser; mobile dependencies are not installed in this workspace, so a full Expo native build was not run.
- `docker compose config --quiet` and `git diff --check` pass.
- The repository has no automated backend/web test scripts; syntax, schema, route-load, bundle, and configuration validation are the available checks.

## NFC Reader

Package:

- Path: `nfc-reader/package.json`.
- Script: `npm start`.
- Dependencies: `dotenv`, `nfc-pcsc`.

Client behavior:

- Path: `nfc-reader/index.js`.
- Requires `NFC_API_KEY` and `DEVICE_SERIAL`.
- `API_URL` defaults to `http://localhost:3001`.
- Sends headers `X-Api-Key` and `X-Device-Serial`.
- Sends heartbeats to `/api/nfc/heartbeat` every 10s.
- Sends taps to `/api/nfc/tap`.
- Polls pending write jobs via `/api/nfc/write-jobs/pending`.
- Reports write completion via `/api/nfc/write-jobs/:jobId/complete`.
- Has duplicate tap debounce, longer post-action cooldown, retry queue, startup diagnostics for Linux PC/SC/kernel NFC driver conflicts.

Helper scripts/installers:

- `nfc-reader/start.sh`, `start.command`, `start.bat`.
- `install-autostart.sh`, `install-login-autostart.sh`.
- systemd/desktop/udev examples.

## Deployment

Docker Compose services:

- `postgres`: PostgreSQL 16, host `127.0.0.1:5433`.
- `redis`: Redis 7, host `127.0.0.1:6379`, password configured by env.
- `api`: builds `./server`, host `127.0.0.1:3001`.
- `worker`: builds `./server`, runs `node src/workers/index.js`.
- `accounting`: builds `./server`, runs `node src/accounting-service.js`, host `127.0.0.1:3010`.
- `crm`: builds `./server`, runs `node src/crm-service.js`, host `127.0.0.1:3011`.
- `web`: builds `./web`, host `127.0.0.1:8080`.
- `backup`: Postgres image running cron backup script.

Compose/deploy notes:

- Required Compose secrets include `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `PLATFORM_ADMIN_EMAIL`, and `PLATFORM_ADMIN_PASSWORD`.
- Set `WEB_APP_URL` in deployments so password reset emails point to the public web app.
- The API image command seeds and starts the server; it does not run `prisma db push`.
- `deploy.sh` builds fresh backend images, runs `npx prisma migrate deploy` from the new API image, then restarts `api`, `worker`, `accounting`, and `crm`.
- Backup/restore scripts require `POSTGRES_PASSWORD`; they do not default to a known password.

Volumes:

- `pg-data`, `redis-data`, `app-data`, `backup-data`.

Network:

- Single internal bridge network.
- Host-level Nginx/SSL is described in docs; Docker `web` container also performs service-aware API proxying.

## Development Commands

Typical local flow from README:

```bash
docker compose up -d postgres redis
cd server && npm install && npx prisma migrate deploy && node src/seed.js && node src/index.js
cd server && PORT=3010 node src/accounting-service.js
cd server && PORT=3011 node src/crm-service.js
cd web && npm install && npm run dev
cd mobile && npm install && npx expo start
```

Useful package scripts:

```bash
cd server && npm run dev
cd server && npm run worker
cd server && npm run db:migrate
cd server && npm run db:seed
cd web && npm run build
cd mobile && npm start
cd nfc-reader && npm start
```

## Gotchas For Future Work

- Preserve tenant isolation: always scope tenant data by `orgId`.
- Use existing domain API modules before adding new API methods to the old aggregate files.
- When adding backend routes, wire the correct process: main API vs `accounting-service.js` vs `crm-service.js`.
- In local Vite dev, CRM/accounting requests proxy to the main API by default, while production nginx sends them to microservices. If testing extracted microservices locally, adjust proxying or hit ports directly.
- CSRF applies on the main API. Web sends the token from `csrf_token`; mobile uses bearer tokens without CSRF header.
- NFC routes are intentionally mounted before the general API limiter in the main API.
- `web/nginx.conf` is the production route splitter for microservices.
- `mobile/app.json` controls the production mobile API base URL through `expo.extra.apiUrl`.
- There are no test scripts in the package manifests, so verification is usually build/run/manual unless tests are added.
- Avoid committing generated folders like `node_modules`, build outputs, local `.env`, Expo transient data, or backups unless explicitly requested.
