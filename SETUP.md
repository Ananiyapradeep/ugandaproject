# Uganda Wildlife Sanctuary — Setup Guide
## Real OTP + Admin Dashboard

---

## 1. Install Dependencies

```bash
npm install nodemailer node-fetch cors express
```

---

## 2. Enable Real OTP Delivery

### Option A — Gmail (Email OTP)

1. Go to your Google Account → Security → 2-Step Verification → **App Passwords**
2. Generate an App Password for "Mail"
3. Set environment variables:

```bash
# Windows (PowerShell)
$env:EMAIL_USER="you@gmail.com"
$env:EMAIL_PASS="xxxx xxxx xxxx xxxx"   # 16-char App Password

# Mac/Linux
export EMAIL_USER="you@gmail.com"
export EMAIL_PASS="xxxx xxxx xxxx xxxx"
```

### Option B — Africa's Talking SMS (Phone OTP)

1. Sign up free at https://africastalking.com
2. Get your API key from the dashboard
3. Set environment variables:

```bash
# Sandbox (free testing — OTPs go to the AT simulator)
export AT_API_KEY="your-api-key"
export AT_USERNAME="sandbox"

# Production (real SMS delivery)
export AT_API_KEY="your-live-api-key"
export AT_USERNAME="your-at-username"
export AT_SENDER_ID="UWildlife"
```

> **Dev Mode**: If neither is configured, OTPs print to the server terminal and
> are returned in the API response as `_dev_otp` for easy testing.

---

## 3. Start the Server

```bash
node server.js
```

Output:
```
╔══════════════════════════════════════════════╗
║   Uganda Wildlife Sanctuary — WildEye API   ║
╠══════════════════════════════════════════════╣
║  App       →  http://localhost:3000            ║
║  Admin     →  http://localhost:3000/admin       ║
║  API Docs  →  http://localhost:3000/docs        ║
║  OTP Mode  →  DEV (console only)               ║
╚══════════════════════════════════════════════╝
```

---

## 4. Access the Admin Dashboard

1. Open http://localhost:3000/admin
2. Enter the admin token: **`uws-admin-2024`**
3. Change the token via environment variable:

```bash
export ADMIN_SECRET="your-secure-token"
```

### Dashboard Features

| Page | Description |
|------|-------------|
| **Dashboard** | Total bookings, revenue, confirmed/cancelled counts, daily bar chart, top parks donut |
| **All Bookings** | Full searchable/filterable table with View + Cancel actions |
| **Parks** | Revenue and booking count per park with progress bars |
| **Users** | All users extracted from booking holder data |

---

## 5. OTP Flow (How It Works)

```
User enters phone/email
        ↓
POST /api/v1/auth/send-otp
        ↓
  isPhone? → SMS via Africa's Talking
  isEmail? → Email via Gmail SMTP
        ↓
OTP stored in memory with 10-min TTL
        ↓
User enters OTP
        ↓
POST /api/v1/auth/verify-otp
  → max 5 attempts before invalidation
        ↓
Returns JWT token + user object
```

---

## 6. Protect in Production

```bash
# Use a proper secret
export ADMIN_SECRET="$(openssl rand -hex 32)"

# Set production mode (hides _dev_otp from API responses)
export NODE_ENV="production"

# Use a real database (MongoDB/PostgreSQL) instead of in-memory stores
# The server.js uses plain objects — replace `users`, `bookings`, `otpStore`
# with your DB calls
```

---

## 7. API Endpoints Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/v1/auth/send-otp` | — | Send OTP to email or phone |
| `POST` | `/api/v1/auth/verify-otp` | — | Verify OTP, get token |
| `POST` | `/api/v1/auth/register` | — | Register new user |
| `POST` | `/api/v1/bookings` | — | Create booking |
| `GET`  | `/api/v1/bookings/:id` | — | Get booking by ID |
| `DELETE` | `/api/v1/bookings/:id` | — | Cancel booking |
| `POST` | `/api/v1/bookings/cancel` | — | Cancel by reference |
| `POST` | `/api/v1/payments/confirm` | — | Confirm payment |
| `GET`  | `/api/v1/admin/stats` | Admin token | Dashboard statistics |
| `GET`  | `/api/v1/admin/bookings` | Admin token | All bookings (paginated) |
| `GET`  | `/openapi.json` | — | OpenAPI spec |
| `GET`  | `/docs` | — | Swagger UI |
| `GET`  | `/health` | — | Health check |
