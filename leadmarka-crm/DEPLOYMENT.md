# LeadMarka - Deployment Guide

## Overview

LeadMarka is a mobile-first WhatsApp CRM built with:
- **Frontend**: React + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Email**: Resend

## Monitoring (minimal)

See [MONITORING.md](MONITORING.md) for a minimal setup (uptime monitoring + error tracking + logs).

## Prerequisites

1. Node.js 18+ installed
2. Supabase account
3. Resend account (for email notifications)
4. Hosting platform (e.g. Vercel, Railway)

## Setup Instructions

### 1. Database Setup (Supabase)

1. Create a new Supabase project
2. Go to SQL Editor
3. Copy and paste the contents of `database/schema.sql`
4. Run the SQL to create tables
5. Go to Settings > API and copy:
   - Project URL
   - Project API Keys (anon and service_role)

### 2. Backend Setup

```bash
cd backend
npm install
```

Create `.env` file:
```
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
JWT_SECRET=your_random_jwt_secret_min_32_chars
RESEND_API_KEY=your_resend_api_key
FROM_EMAIL=info@update.leadmarka.co.zw
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-frontend-url.com
```

Start the server:
```bash
npm start
# or for development:
npm run dev
```

For **production** reminders, use an external cron that calls your API every minute (see [Reminders in production](#reminders-in-production) and [CRON_FREE.md](CRON_FREE.md)). For **local** development you can run the reminder worker in a separate terminal: `npm run worker`.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` file:
```
REACT_APP_API_URL=https://your-backend-url.com/api
```

For development with proxy:
```
# No env needed - uses proxy in package.json
```

Start the app:
```bash
npm start
```

Build for production:
```bash
npm run build
```

## Deployment Options

### Option A: Vercel (Frontend + Backend API)

Deploy the backend API and frontend as separate Vercel projects. Reminders run via an external cron calling your API every minute—see [Reminders in production](#reminders-in-production) and [CRON_FREE.md](CRON_FREE.md). See also [backend/VERCEL_DEPLOYMENT.md](backend/VERCEL_DEPLOYMENT.md) for step-by-step backend setup.

**Frontend (Vercel):**
1. Import project from GitHub; set root directory to `frontend`
2. Framework Preset: Create React App; Build Command: `npm run build`; Output Directory: `build`
3. Add `REACT_APP_API_URL` pointing to your backend API URL (e.g. `https://<your-backend>.vercel.app/api`)

**Marketing site (optional, separate Vercel project):**  
See [MARKETING_DEPLOYMENT.md](MARKETING_DEPLOYMENT.md) to deploy the static landing site from `leadmarka-crm/marketing` as its own Vercel project (or Netlify / GitHub Pages).

### Reminders in production

Reminders (follow-up emails and daily summaries) are triggered by calling the backend every minute. Use an external cron service (e.g. [cron-job.org](https://cron-job.org)) to GET your cron endpoint. Full setup: [CRON_FREE.md](CRON_FREE.md). Required: set `CRON_SECRET` in your backend environment and configure the cron job with that secret (query param `secret` or `Authorization: Bearer <CRON_SECRET>`).


### Option B: Railway (Full Stack)

1. Push code to GitHub
2. Create new project on Railway
3. Add PostgreSQL database (or use external Supabase)
4. Deploy backend service
5. Add a separate worker service (same repo/root `backend`) with start command `npm run worker`
6. Deploy frontend service
7. Configure environment variables

### Option C: Self-Hosted (VPS)

```bash
# On your server
git clone <your-repo>
cd leadmarka-crm

# Backend
cd backend
npm install --production
cp .env.example .env
# Edit .env with your values
npm start

# Frontend (build and serve with nginx)
cd ../frontend
npm install
npm run build
# Copy build folder to /var/www/html
# Configure nginx
```

## Environment Variables

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Supabase project URL | |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | |
| `SUPABASE_ANON_KEY` | Supabase anon key | |
| `JWT_SECRET` | Random string for JWT signing (min 32 chars) | |
| `RESEND_API_KEY` | Resend API key for emails | |
| `FROM_EMAIL` | Sender email address | `info@update.leadmarka.co.zw` |
| `FRONTEND_URL` | Frontend app URL | |
| `CRON_SECRET` | Secret for `/api/cron/reminders` (required when using external cron; see [CRON_FREE.md](CRON_FREE.md)) | |
| `PORT` | Server port (default: 3001) | |
| `NODE_ENV` | production or development | |
| **Paynow (Billing)** | **Required for subscription payments** | |
| `PAYNOW_MODE` | Payment mode: `live` or `test` | `live` |
| `PAYNOW_INTEGRATION_ID` | Paynow merchant integration ID | `12345` |
| `PAYNOW_INTEGRATION_KEY` | Paynow merchant integration key | |
| `PAYNOW_RESULT_URL_BASE` | Backend URL for webhook callbacks (required in production) | `https://api.leadmarka.co.zw` |
| `PAYNOW_RETURN_URL_BASE` | Frontend URL for user redirects (optional, defaults to FRONTEND_URL) | `https://app.leadmarka.co.zw` |
| `PAYNOW_TEST_AUTH_EMAIL` | Email for test transactions (required when PAYNOW_MODE=test) | `test@example.com` |

> **Note:** See [PAYNOW_PRODUCTION_GUIDE.md](PAYNOW_PRODUCTION_GUIDE.md) for detailed Paynow setup instructions.

### Frontend (.env)

| Variable | Description |
|----------|-------------|
| `REACT_APP_API_URL` | Backend API URL |

## Testing

1. **Authentication**: Register a new account
2. **Leads**: Add a test lead
3. **Follow-ups**: Schedule a follow-up for 1 minute from now
4. **WhatsApp**: Click "Chat on WhatsApp" button
5. **Reminders**: Wait for email reminder

## Important Notes

- Reminder service checks every minute for due follow-ups (triggered by external cron calling your API; see [CRON_FREE.md](CRON_FREE.md))
- Phone numbers must include country code (e.g., +263)
- Email notifications require valid Resend API key and verified domain
- All data is isolated per user account
- No WhatsApp API integration (intentionally out of scope for MVP)

## Troubleshooting

**Emails not sending:**
- Check Resend API key
- Verify sender email domain in Resend
- Check server logs for errors

**Database connection errors:**
- Verify Supabase credentials
- Check Row Level Security (RLS) policies
- Ensure IP is not blocked

**CORS errors:**
- Update `FRONTEND_URL` in backend .env
- Check CORS configuration in server.js

## Support

For issues or questions, refer to the PRD.md file or contact support.

---

**Built for Zimbabwean SMEs. Never forget a WhatsApp lead again.**
