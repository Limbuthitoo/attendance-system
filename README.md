# Archisys Attendance Management System

A professional and minimal attendance management system for **Archisys Innovations** — includes a backend API, a modern web dashboard, a mobile app, and NFC card reader support.

## Architecture

```
├── server/         → Node.js + Express API with SQLite
├── web/            → React + Vite + Tailwind CSS dashboard
├── mobile/         → React Native + Expo mobile app
└── nfc-reader/     → NFC card reader service (ACR122U)
```

## Features

### Employees
- Clock in / Clock out with timestamps
- View attendance history by month
- Apply for leave (Sick, Casual, Earned, Unpaid)
- Cancel pending leave requests
- Dashboard with monthly stats & work hours

### Admin
- View all employee attendance for any date
- Approve / Reject leave requests with notes
- Add, edit, activate/deactivate employees
- Admin dashboard with company-wide metrics
- Reset employee passwords
- Manage NFC cards (assign, deactivate, delete)
- Write employee ID to blank NFC cards
- Real-time NFC tap alerts via SSE (browser notifications)
- Activity log with unified timeline (attendance, NFC taps, leaves)
- Configurable office settings (hours, thresholds, working days)

### NFC Card Reader (Optional)
- Tap-to-attend using ACR122U USB reader
- Automatic check-in / check-out based on time
- Card write support (provision new cards from the dashboard)
- Debounce, retry queue, and audit logging

## Quick Start

### 1. Backend Server

```bash
cd server
npm install
npm run seed     # Creates sample data + admin account
npm run dev      # Starts on http://localhost:3001
```

**Default login credentials:**
| Role     | Email                  | Password     |
|----------|------------------------|--------------|
| Admin    | admin@archisys.com     | admin123     |
| Admin    | priya@archisys.com     | password123  |
| Employee | rajesh@archisys.com    | password123  |
| Employee | sita@archisys.com      | password123  |
| Employee | bikash@archisys.com    | password123  |

### 2. Web Dashboard

```bash
cd web
npm install
npm run dev      # Starts on http://localhost:5173
```

The web app proxies API calls to the backend at `:3001`.

### 3. Mobile App (Expo)

```bash
cd mobile
npm install
npx expo start   # Scan QR code with Expo Go
```

> **Note:** For physical device testing, update the `API_BASE` URL in `mobile/src/api.js` to your machine's local IP (e.g., `http://192.168.1.100:3001/api`).

### 4. NFC Card Reader (Optional)

Requires an **ACS ACR122U** USB NFC reader.

```bash
cd nfc-reader
npm install
cp .env.example .env   # Set API_URL and NFC_API_KEY (must match server/.env)
npm start
```

See [HOSTING.md](HOSTING.md) for full NFC setup instructions including driver installation.

## API Endpoints

### Auth
| Method | Endpoint                 | Description          |
|--------|--------------------------|----------------------|
| POST   | `/api/auth/login`        | Login                |
| GET    | `/api/auth/me`           | Get current user     |
| PUT    | `/api/auth/change-password` | Change password   |

### Attendance
| Method | Endpoint                    | Description               |
|--------|-----------------------------|---------------------------|
| POST   | `/api/attendance/check-in`  | Check in                  |
| POST   | `/api/attendance/check-out` | Check out                 |
| GET    | `/api/attendance/today`     | Today's record            |
| GET    | `/api/attendance/history`   | Monthly history           |
| GET    | `/api/attendance/all`       | All attendance (admin)    |

### Leaves
| Method | Endpoint                    | Description               |
|--------|-----------------------------|---------------------------|
| POST   | `/api/leaves`               | Apply for leave           |
| GET    | `/api/leaves/my`            | My leave requests         |
| GET    | `/api/leaves/all`           | All leaves (admin)        |
| PUT    | `/api/leaves/:id/review`    | Approve/reject (admin)    |
| DELETE | `/api/leaves/:id`           | Cancel pending leave      |

### Employees (Admin)
| Method | Endpoint                          | Description          |
|--------|-----------------------------------|----------------------|
| GET    | `/api/employees`                  | List employees       |
| POST   | `/api/employees`                  | Create employee      |
| PUT    | `/api/employees/:id`              | Update employee      |
| PUT    | `/api/employees/:id/reset-password` | Reset password    |

### Dashboard
| Method | Endpoint                     | Description              |
|--------|------------------------------|--------------------------|
| GET    | `/api/dashboard/stats`       | Get statistics           |
| GET    | `/api/dashboard/activity-log`| Unified activity timeline|

### Office Settings
| Method | Endpoint           | Description                  |
|--------|--------------------|------------------------------|
| GET    | `/api/settings`    | Get office settings (any user)|
| PUT    | `/api/settings`    | Update settings (admin)      |

### NFC
| Method | Endpoint                          | Auth     | Description                    |
|--------|-----------------------------------|----------|--------------------------------|
| POST   | `/api/nfc/tap`                    | API Key  | Record card tap (check-in/out) |
| GET    | `/api/nfc/cards`                  | Admin    | List all NFC cards             |
| GET    | `/api/nfc/cards/employee/:id`     | Admin    | Cards for an employee          |
| POST   | `/api/nfc/cards`                  | Admin    | Assign card to employee        |
| PUT    | `/api/nfc/cards/:id/deactivate`   | Admin    | Deactivate card                |
| PUT    | `/api/nfc/cards/:id/activate`     | Admin    | Reactivate card                |
| DELETE | `/api/nfc/cards/:id`              | Admin    | Delete card                    |
| GET    | `/api/nfc/tap-log`                | Admin    | View tap audit log             |
| GET    | `/api/nfc/readers`                | Admin    | List reader devices            |
| POST   | `/api/nfc/readers`                | Admin    | Register a reader              |
| POST   | `/api/nfc/write-jobs`             | Admin    | Queue card write job           |
| GET    | `/api/nfc/write-jobs`             | Admin    | List write jobs                |
| PUT    | `/api/nfc/write-jobs/:id/cancel`  | Admin    | Cancel write job               |
| GET    | `/api/nfc/write-jobs/pending`     | API Key  | Reader polls for write jobs    |
| PUT    | `/api/nfc/write-jobs/:id/complete`| API Key  | Reader reports write result    |
| GET    | `/api/nfc/events`                 | Admin    | SSE stream for real-time alerts|

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3, JWT, bcryptjs, helmet, compression, express-rate-limit
- **Web:** React 18, Vite, Tailwind CSS, React Router, Lucide Icons
- **Mobile:** React Native, Expo (SDK 54), React Navigation, Expo SecureStore
- **NFC:** nfc-pcsc (ACR122U), PC/SC protocol

## Security

- Helmet security headers
- Rate limiting on auth routes (100 requests / 15 min)
- CORS origin restriction
- API key authentication for NFC reader devices
- Request body size limit (1MB)

## Deployment

See [HOSTING.md](HOSTING.md) for full deployment instructions covering:
- **Render.com** (free tier)
- **VPS** (DigitalOcean, AWS, Linode) with Nginx + PM2 + SSL
- **Docker** (docker-compose)
- **Mobile builds** (EAS Build for APK/IPA)

---

Built for **Archisys Innovations** © 2026
