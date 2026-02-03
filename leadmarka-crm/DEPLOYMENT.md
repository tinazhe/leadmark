# LeadMarka - Deployment Guide

## Overview

LeadMarka is a mobile-first WhatsApp CRM built with:
- **Frontend**: React + Tailwind CSS
- **Backend**: Node.js + Express
- **Database**: Supabase (PostgreSQL)
- **Email**: Resend

## Prerequisites

1. Node.js 18+ installed
2. Supabase account
3. Resend account (for email notifications)
4. Hosting platform (Vercel, Render, Railway, etc.)

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
FROM_EMAIL=noreply@yourdomain.com
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

Start the reminder worker in a separate process:
```bash
npm run worker
```

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

### Option A: Vercel (Frontend) + Render (Backend)

**Backend (Render):**
1. Push code to GitHub
2. Create new Web Service on Render
3. Connect your repo
4. Set root directory to `backend`
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Add environment variables from `.env`
8. Create a separate Background Worker service:
   - Root directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm run worker`

**Frontend (Vercel):**
1. Import project from GitHub
2. Set root directory to `frontend`
3. Framework Preset: Create React App
4. Build Command: `npm run build`
5. Output Directory: `build`
6. Add `REACT_APP_API_URL` environment variable

### Option A2: Vercel (Backend API) + Render (Worker)

If you deploy the API to Vercel, you still need a separate long-running process for reminders because Vercel Serverless Functions are not always-on workers.

**Worker (Render Background Worker):**
1. Push code to GitHub
2. Create a new Render **Blueprint** using `render.yaml` (or create a Background Worker manually)
3. Ensure the worker root directory is `backend`
4. Build Command: `npm ci`
5. Start Command: `npm run worker`
6. Add the same backend environment variables (see Backend `.env` table below), especially:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `SUPABASE_ANON_KEY`
   - `RESEND_API_KEY`
   - `FROM_EMAIL`
   - `FRONTEND_URL`
   - `JWT_SECRET`
   - `NODE_ENV=production`

**Note on duplicates:** For high reliability, keep the `notification_claimed_at` column/migration applied so multiple worker instances don’t send duplicate emails.

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

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `JWT_SECRET` | Random string for JWT signing (min 32 chars) |
| `RESEND_API_KEY` | Resend API key for emails |
| `FROM_EMAIL` | Sender email address |
| `FRONTEND_URL` | Frontend app URL |
| `PORT` | Server port (default: 3001) |
| `NODE_ENV` | production or development |

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

- Reminder service checks every minute for due follow-ups
- The reminder worker must run on a platform that supports always-on background processes (not Vercel)
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
