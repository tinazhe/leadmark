# Deploy Reminder Worker on Render

The reminder worker runs the cron that sends follow-up emails. It must run as an **always-on** process (Render Background Worker).

**No budget for Render?** Use the [free cron option](./CRON_FREE.md) instead: trigger reminders by calling your Vercel API every minute from cron-job.org (or similar).

---

## Option A: Blueprint (render.yaml)

1. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
2. Connect your GitHub account and select the **leadmark** (or LeadMaka) repo.
3. **Root Directory** (for the Blueprint): leave empty if the repo root is the repo; or set to **`leadmarka-crm`** if Render doesn’t find `render.yaml` at repo root.
4. Render will read `render.yaml` and create the worker **leadmarka-reminder-worker** with:
   - **Root Directory:** `leadmarka-crm/backend`
   - **Build:** `npm ci`
   - **Start:** `npm run worker`
5. Add **Environment** variables (same as backend):

   | Key | Value |
   |-----|--------|
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_SERVICE_KEY` | Supabase service_role key |
   | `SUPABASE_ANON_KEY` | Supabase anon key |
   | `JWT_SECRET` | Same as backend (≥32 chars) |
   | `RESEND_API_KEY` | Resend API key |
   | `FROM_EMAIL` | Verified sender email |
   | `FRONTEND_URL` | Frontend app URL |
   | `NODE_ENV` | `production` |

6. Click **Apply** and deploy.

---

## Option B: Manual Background Worker

1. **New** → **Background Worker**.
2. Connect the repo; select **leadmark** (or your repo).
3. **Root Directory:** `leadmarka-crm/backend` (or `backend` if repo root is already `leadmarka-crm`).
4. **Build Command:** `npm ci`
5. **Start Command:** `npm run worker`
6. Add the same environment variables as in the table above.
7. **Create Background Worker**.

---

## Check it’s running

- In the worker’s **Logs** you should see: `Starting reminder service...` and `Checking for reminders...` every minute.
- Create a follow-up due in a few minutes and confirm the reminder email is received.
