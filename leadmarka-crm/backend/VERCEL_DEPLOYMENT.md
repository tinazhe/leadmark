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
| `FROM_EMAIL` | Verified sender email | e.g. `noreply@yourdomain.com` |
| `FRONTEND_URL` | Your frontend URL | e.g. `https://your-app.vercel.app` |
| `NODE_ENV` | `production` | |
| `CRON_SECRET` | (Optional) Secret for `/api/cron/reminders` | Only if using [free cron](../CRON_FREE.md) instead of Render worker |

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

## 7. Reminder worker (required)

Vercel does not run long-lived crons. Use **Render** (or another host) for the reminder worker:

1. **Render** → New → **Background Worker**
2. Connect the same repo, **Root directory**: `leadmarka-crm/backend`
3. **Start command**: `npm run worker`
4. Add the **same** environment variables as above.
5. Deploy.

---

## Verify

- **Health:** `GET https://<your-backend>.vercel.app/api/health` → `{"status":"ok",...}`
- **Frontend:** Log in and use the app; check Network tab that requests go to your backend URL.
