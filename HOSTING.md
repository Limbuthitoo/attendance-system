# Archisys Attendance — Setup & Hosting Guide

> Simple step-by-step instructions to install and host the Archisys Attendance system.
> No prior experience needed — just follow each step in order.

---

## What's Inside

| Folder | What It Is |
|--------|-----------|
| `server/` | Backend API (the brain — handles data, login, attendance, office settings) |
| `web/` | Admin website (manage employees, office settings, activity log, NFC, leaves) |
| `mobile/` | Phone app for employees (check in/out, apply leave) |
| `nfc-reader/` | Optional — connects a USB card reader for tap-to-attend |

---

## PART 1 — Run It On Your Computer

### What You Need First

1. **Node.js** (version 18 or newer) — download from https://nodejs.org
2. **Git** — download from https://git-scm.com
3. **Expo Go app** on your phone — download from App Store or Play Store

To check if you already have them, open Terminal and type:
```
node -v
git --version
```

### Step 1: Get the Code

```
git clone https://github.com/YOUR_USERNAME/archisys-attendance.git
cd archisys-attendance
```

### Step 2: Start the Backend Server

```
cd server
npm install
cp .env.example .env
npm run seed
npm start
```

You should see: `Archisys Attendance Server running on port 3001`

That means the backend is working.

### Step 3: Start the Website

Open a **new terminal window** and run:
```
cd web
npm install
npm run dev
```

Open your browser and go to: **http://localhost:5173**

### Step 4: Start the Mobile App

Open another **new terminal window** and run:
```
cd mobile
npm install
npx expo start
```

A QR code will appear. Scan it with the **Expo Go** app on your phone.

**Phone can't connect?** Your phone and computer must be on the **same WiFi**.
Then open the file `mobile/src/api.js` and change `localhost` to your computer's IP address:

- **Mac:** Open Terminal, type `ipconfig getifaddr en0`
- **Windows:** Open Command Prompt, type `ipconfig`, look for "IPv4 Address"

Example: Change `http://localhost:3001/api` to `http://192.168.1.5:3001/api`

### Step 5: Login

| Who | Email | Password |
|-----|-------|----------|
| **Admin** | admin@archisys.com | admin123 |
| **Admin** | priya@archisys.com | password123 |
| **Employee** | rajesh@archisys.com | password123 |
| **Employee** | sita@archisys.com | password123 |
| **Employee** | bikash@archisys.com | password123 |

**Change the admin password after your first login!**

### Step 6: Configure Office Hours

Log in as admin → **Office Settings** in the sidebar. Set:
- Office start/end time
- Late grace period (minutes)
- Half-day threshold (hours)
- Working days
- Company name and timezone

---

## PART 2 — Put It On The Internet (Free — Using Render.com)

This makes your app accessible from anywhere, not just your computer.

### Step 1: Upload Your Code to GitHub

1. Go to https://github.com and create an account (or log in)
2. Click the **"+"** button (top right) → **"New repository"**
3. Name it anything (e.g. `attendance-system`)
4. Set it to **Private**
5. Click **"Create repository"**
6. Open Terminal in your project folder and run:

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/attendance-system.git
git push -u origin main
```

### Step 2: Deploy the Backend (API Server)

1. Go to https://render.com and sign up using your GitHub account
2. Click **"New +"** → **"Web Service"**
3. Select your `attendance-system` repository
4. Fill in these settings:

| Setting | What to type |
|---------|-------------|
| Name | `archisys-api` |
| Root Directory | `server` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `node src/index.js` |
| Instance Type | `Free` |

5. Scroll down to **"Environment Variables"** and add these one by one:

| Key | Value |
|-----|-------|
| `PORT` | `3001` |
| `JWT_SECRET` | Click **"Generate"** to create a random value |
| `NODE_ENV` | `production` |
| `CORS_ORIGIN` | `*` (you'll change this later) |

6. Click **"Deploy Web Service"**
7. Wait 2-3 minutes until it says **"Live"**
8. You'll see a URL like: `https://archisys-api-abcd.onrender.com` — **copy this URL**
9. Click the **"Shell"** tab at the top, type `npm run seed` and press Enter (this creates the default accounts)

### Step 3: Deploy the Website

1. On Render, click **"New +"** → **"Static Site"**
2. Select the same repository
3. Fill in:

| Setting | What to type |
|---------|-------------|
| Name | `archisys-web` |
| Root Directory | `web` |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |

4. Add this **Environment Variable**:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | Paste your backend URL from Step 2 (e.g. `https://archisys-api-abcd.onrender.com`) |

5. Click **"Deploy Static Site"**
6. Wait for it to finish. Your website URL will look like: `https://archisys-web-abcd.onrender.com`

### Step 4: Secure It

Go back to your **backend service** on Render:
1. Click **"Environment"**
2. Change `CORS_ORIGIN` from `*` to your actual website URL (e.g. `https://archisys-web-abcd.onrender.com`)
3. Click **"Save Changes"** — it will redeploy automatically

### Step 5: Set Up the Mobile App

Open `mobile/src/api.js` and change the API address to your Render backend:
```
const API_BASE = 'https://archisys-api-abcd.onrender.com/api';
```

Now the mobile app connects to your live server instead of your computer.

### Important Note About Free Tier

Render's free tier **sleeps after 15 minutes** of no activity. The first visit after sleep takes about 30 seconds to wake up. This is normal. For always-on service, upgrade to their paid plan ($7/month).

---

## PART 3 — Deploy With Docker (For Technical Users)

If you have Docker installed and prefer containers:

### Step 1: Create a `.env` file in the project root

```
JWT_SECRET=type-a-long-random-string-here
CORS_ORIGIN=*
NFC_API_KEY=type-another-random-string-here
VITE_API_URL=http://localhost:3001
```

### Step 2: Start Everything

```
docker compose up -d --build
```

### Step 3: Create Default Accounts

```
docker compose exec api npm run seed
```

### Step 4: Open

- **Website:** http://localhost
- **API:** http://localhost:3001

### To Stop

```
docker compose down
```

---

## PART 4 — Deploy on a VPS (DigitalOcean, AWS, Linode)

For full control over your own server.

### Step 1: Connect to Your Server

```
ssh root@your-server-ip
```

### Step 2: Install Required Software

```
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs nginx git
sudo npm install -g pm2
```

### Step 3: Get the Code and Set Up Backend

```
git clone https://github.com/YOUR_USERNAME/attendance-system.git /var/www/attendance
cd /var/www/attendance/server
npm install --production
cp .env.example .env
nano .env
```

In the `.env` file, set:
- `JWT_SECRET` = a long random string
- `CORS_ORIGIN` = your domain (e.g. `https://attendance.yourcompany.com`)

Then:
```
npm run seed
pm2 start src/index.js --name "attendance-api"
pm2 save
pm2 startup
```

### Step 4: Build the Website

```
cd /var/www/attendance/web
npm install
npm run build
```

### Step 5: Set Up Nginx (Web Server)

Create the file `/etc/nginx/sites-available/attendance`:
```
server {
    listen 80;
    server_name your-domain.com;

    location / {
        root /var/www/attendance/web/dist;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:
```
sudo ln -s /etc/nginx/sites-available/attendance /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

### Step 6: Add HTTPS (Free)

```
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

Done! Your site now has a secure HTTPS connection.

---

## PART 5 — NFC Card Reader (Optional)

This lets employees tap an NFC card to check in/out instead of using the app.

### What You Need to Buy

- **ACS ACR122U** USB NFC reader (~$30 online)
- **MIFARE Classic** NFC cards or keyfobs (any 13.56 MHz cards)

### Install Drivers (Linux Only)

```
sudo apt install -y pcscd libpcsclite1 libpcsclite-dev
sudo systemctl enable pcscd && sudo systemctl start pcscd
```

Mac and Windows: no extra drivers needed (Mac has built-in support; Windows — install from https://www.acs.com.hk/en/driver/3/acr122u-usb-nfc-reader/).

### Set Up the Reader Software

```
cd nfc-reader
npm install
cp .env.example .env
```

Edit the `.env` file:
```
API_URL=http://localhost:3001
NFC_API_KEY=paste-the-same-key-from-server-env
DEVICE_ID=front-desk-01
```

The `NFC_API_KEY` must be the **exact same value** as in `server/.env`.

### Start the Reader

Plug in the ACR122U USB reader, then:
```
npm start
```

You should see:
```
[NFC] Reader detected: ACS ACR122U
[NFC] Waiting for cards...
```

### How It Works

- Employee taps card → automatically checks in (morning) or checks out (if already checked in)
- Admin can assign cards to employees from the web dashboard: **Employees** → click **NFC** button → enter card UID
- Admin can also write employee ID to a blank card: click **"Queue Write Job"** → place card on reader

---

## PART 6 — Build Mobile App for Distribution

To share the app without Expo Go:

### Install Build Tool

```
npm install -g eas-cli
eas login
```

### Update the API Address

Open `mobile/src/api.js` and set your production backend URL:
```
const API_BASE = 'https://your-backend-url.com/api';
```

### Build for Android (Free)

```
cd mobile
eas build --platform android --profile preview
```

This creates a downloadable `.apk` file you can share directly.

### Build for iOS

```
eas build --platform ios
```

Requires an Apple Developer account ($99/year).

---

## Custom Domain (Optional)

If you have your own domain (e.g. `attendance.yourcompany.com`):

**On Render:**
1. Go to your Static Site → **Settings** → **Custom Domains**
2. Add your domain
3. In your domain provider's DNS settings, add a **CNAME** record pointing to the Render URL
4. Render gives you free HTTPS automatically

**On VPS:** Already covered in Part 4, Step 6 (Certbot).

---

## Company Branding

To put your own company name and logo:

| What to Change | Where |
|---------------|-------|
| Mobile app icon | Replace `mobile/assets/icon.png` (1024×1024 PNG) |
| Mobile splash screen | Replace `mobile/assets/splash.png` (1284×2778 PNG) |
| Website favicon | Replace `web/public/favicon.svg` |
| Company name in sidebar | Edit `web/src/components/Layout.jsx` — search for "Archisys" |
| Company name on login page | Edit `web/src/pages/Login.jsx` — search for "Archisys" |
| Company name (dynamic) | Admin → **Office Settings** → Company Name |

---

## Troubleshooting

**"Port already in use"**
→ Run: `lsof -ti:3001 | xargs kill -9`

**Mobile says "Network Request Failed"**
→ Change `API_BASE` in `mobile/src/api.js` to your computer's IP (not `localhost`)
→ Make sure phone and computer are on the same WiFi

**"Invalid credentials" when logging in**
→ Run `npm run seed` in the server folder to create default accounts

**Website shows blank page after deploying**
→ Make sure Publish Directory is `dist` (not `build`)
→ Check that `VITE_API_URL` environment variable is set

**CORS error in browser console**
→ Set `CORS_ORIGIN` in server `.env` to your exact website URL

**Render site takes 30 seconds to load**
→ Free tier sleeps after 15 minutes — this is normal

**NFC reader says "No readers found"**
→ Install PC/SC drivers (see Part 5)
→ Make sure the USB reader is plugged in

**Expo won't start or crashes**
→ Try: `npx expo start -c` (clears cache)
→ Try: `npx expo install --check` (fixes dependency versions)

---

Built for **Archisys Innovations** © 2026
