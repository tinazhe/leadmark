# Reminders Without a Paid Worker (Free)

You can run follow-up reminders **without paying for Render** by calling your backend from a **free external cron** every minute.

---

## 1. Add `CRON_SECRET` to your backend

1. Generate a secret (e.g. run in terminal: `openssl rand -base64 32`).
2. In **Vercel** → your **backend** project → **Settings** → **Environment Variables**:
   - Name: `CRON_SECRET`
   - Value: the string you generated (e.g. `x7Kp...`)
3. **Redeploy** the backend so the new env is used.

---

## 2. Set up a free cron job

Use a free service that can hit a URL every minute, for example:

- **[cron-job.org](https://cron-job.org)** (free, no card required)
- [EasyCron](https://www.easycron.com) (free tier)
- [Uptime Robot](https://uptimerobot.com) (monitoring + optional cron)

### Example: cron-job.org

1. Create an account at [cron-job.org](https://cron-job.org).
2. **Create Cronjob**:
   - **Title:** e.g. `LeadMarka reminders`
   - **URL:** use one of these (replace `<your-backend>` and `<your-CRON_SECRET>`):
     - `https://<your-backend>.vercel.app/api/cron/reminders?secret=<your-CRON_SECRET>`
     - If you get **404**, try: `https://<your-backend>.vercel.app/cron/reminders?secret=<your-CRON_SECRET>`
   - **Schedule:** Every minute (`* * * * *` or use the “Every minute” preset).
   - **Request Method:** GET.
3. Save. The job will call your API every minute; your API runs the reminder check and daily summary logic.

---

## 3. Verify

- In cron-job.org, check the job’s **Execution history** for 200 responses.
- Create a follow-up due in a few minutes and confirm you receive the reminder email.

---

## Security

- **CRON_SECRET** must match between Vercel and the URL (query param `secret`) or use **Authorization: Bearer &lt;CRON_SECRET&gt;** in the request header.
- Do not share or commit `CRON_SECRET`; use env vars only.
