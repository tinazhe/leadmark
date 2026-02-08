# Deploy Backend API to Vercel

Follow these steps in the browser. You’re on **https://vercel.com/new** with the **leadmark** repo visible.

---

## 1. Import the project

- Click **Import** next to the **leadmark** repository.
- If you don’t see it, use “Enter a Git repository URL” and paste your repo URL, then **Continue**.

---

## 2. Configure the project

On the “Configure Project” screen:

| Field | Value |
|-------|--------|
| **Project Name** | `leadmarka-api` (or any name) |
| **Root Directory** | Click **Edit** → set to **`leadmarka-crm/backend`** |
| **Framework Preset** | Other (leave as is) |
| **Build Command** | `npm install` or leave default |
| **Output Directory** | Leave default (not used for serverless) |
| **Install Command** | `npm install` (default) |

---

## 3. Environment variables

Click **Environment Variables** and add (for Production, and optionally Preview/Development):

| Name | Value | Notes |
|------|--------|--------|
| `SUPABASE_URL` | Your Supabase project URL | Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Supabase **service_role** key | Project Settings → API |
| `SUPABASE_ANON_KEY` | Supabase anon key | Project Settings → API |
| `JWT_SECRET` | Random string ≥32 characters | e.g. `openssl rand -base64 32` |
| `RESEND_API_KEY` | Your Resend API key | Resend dashboard |
| `FROM_EMAIL` | Verified sender email (Resend domain update.leadmarka.co.zw) | `info@update.leadmarka.co.zw` |
| `FRONTEND_URL` | Your frontend URL | e.g. `https://your-app.vercel.app` |
| `NODE_ENV` | `production` | |
| `CRON_SECRET` | Secret for `/api/cron/reminders` | Required for reminders; used by cron-job.org (see [CRON_FREE.md](../CRON_FREE.md)) |

---

## 4. Deploy

- Click **Deploy**.
- Wait for the build to finish.

---

## 5. Get your API URL

- After deploy, open the project → **Settings** → **Domains** (or use the default).
- Your API base URL is: **`https://<your-project>.vercel.app/api`**  
  (include `/api` because routes are mounted under `/api`.)

---

## 6. Point the frontend at the backend (required)

If you see **405 on `/api/auth/login`** or "Invalid email or password" when the backend is correct, the frontend is still calling its own URL instead of the API.

In the **frontend** Vercel project (e.g. the one that serves `leadmark-ten.vercel.app`):

1. **Settings** → **Environment Variables**
2. Add: **`REACT_APP_API_URL`** = `https://<your-backend-project>.vercel.app/api`  
   Use your real backend URL (the Vercel project where you deployed the backend), and keep the `/api` path.
3. **Redeploy** the frontend (Deployments → ⋮ on latest → Redeploy) so the new env is applied.

---

## 7. Reminders via external cron (required)

Reminders are triggered by calling your API every minute. Set up an external cron (e.g. [cron-job.org](https://cron-job.org)) as in [CRON_FREE.md](../CRON_FREE.md):

1. Add **CRON_SECRET** in Vercel (Section 3 above) and redeploy.
2. Create a cron job that GETs `https://<your-backend>.vercel.app/api/cron/reminders?secret=<your-CRON_SECRET>` every minute.

---

## Verify

- **Health:** `GET https://<your-backend>.vercel.app/api/health` → `{"status":"ok",...}`
- **Frontend:** Log in and use the app; check Network tab that requests go to your backend URL.

---

## Troubleshooting: FUNCTION_INVOCATION_FAILED (500)

This error means the serverless function crashed or threw before sending a response. Common causes:

1. **Missing env vars** – The handler catches load-time errors (e.g. missing `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`) and returns 503 with a message. If you see 503, add the required variables in Vercel → Settings → Environment Variables and redeploy.
2. **Unhandled promise rejections** – Any `async` route or middleware that throws or rejects without being caught can crash the invocation. The entry point (`api/index.js`) now registers `process.on('unhandledRejection')` so rejections are logged (and sent to Sentry if configured) instead of crashing the process.
3. **Handler returning before the response is sent** – The handler is now `async` and waits for the response to finish before returning, so the platform doesn’t tear down the function before Express sends the body.

If you still see 500, check Vercel → Project → Logs (or Runtime Logs) for the stack trace and fix the underlying throw/rejection in your routes or middleware.
