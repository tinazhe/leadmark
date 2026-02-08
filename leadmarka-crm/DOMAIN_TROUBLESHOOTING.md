# Domain troubleshooting (leadmarka.co.zw)

Feedback from users:

1. **leadmarka.co.zw** → redirects to **www.leadmarka.co.zw** → **“Server Not Found”** (Firefox).
2. **app.leadmarka.co.zw** → starts loading then **connection times out**.

---

## 1. Fix www / apex (name.co.zw + Vercel)

- **Apex (leadmarka.co.zw)** and **www (www.leadmarka.co.zw)** must have DNS records at your registrar (e.g. name.co.zw) pointing to Vercel.
- In **Vercel** (each project that uses the domain):
  - **Settings → Domains** → add both `leadmarka.co.zw` and `www.leadmarka.co.zw`.
  - Use the DNS records Vercel shows (usually A/CNAME to `76.76.21.21` or `cname.vercel-dns.com`).
- At **name.co.zw**:
  - For **apex** `leadmarka.co.zw`: A record → `76.76.21.21` (or what Vercel says).
  - For **www**: CNAME `www` → `cname.vercel-dns.com` (or A to the same IP if they don’t support CNAME on apex).
- If the registrar forces a redirect from apex → www, then **www** must be the one that points to Vercel; otherwise you get “Server Not Found” when the browser goes to www.

**Quick check:** After saving DNS, run:

```bash
dig leadmarka.co.zw
dig www.leadmarka.co.zw
```

Confirm they resolve to Vercel’s IPs.

---

## 2. Reduce “connection times out” on app.leadmarka.co.zw

- **Cold start:** First request after idle can be slow; a retry after a few seconds often works.
- **Backend:** If the app calls an API (e.g. on Vercel), timeouts can be from:
  - Serverless cold start (Vercel)
  - Network path to your backend (e.g. from Zimbabwe) being slow or blocked.
- **Checks:**
  - Open `https://app.leadmarka.co.zw` and wait 15–30 s; try again once.
  - Test from another network (e.g. mobile data vs WiFi).
  - In the Vercel dashboard, confirm the app and API deployments are healthy and check logs for 5xx or timeouts.

---

## 3. Temporary workaround for users

Until DNS is fixed, you can tell users:

- **Use the app directly:** `https://app.leadmarka.co.zw` (and if it times out, wait and try again or try another network).
- Avoid `https://leadmarka.co.zw` and `https://www.leadmarka.co.zw` until the records above are correct and propagated.

---

## 4. Optional: apex redirect to app

If you want **leadmarka.co.zw** (no www) to always open the app:

- In the **marketing** Vercel project (if it serves the apex domain), add a redirect in `vercel.json`:
  - **From:** `leadmarka.co.zw`
  - **To:** `https://app.leadmarka.co.zw`
  - **Permanent (308).**
- Or use the same at your DNS/hosting: redirect apex to `https://app.leadmarka.co.zw` so one working domain is enough.

Once DNS for both apex and www is correct, you can either keep this redirect or show the marketing site on www and redirect apex to www or app as you prefer.
