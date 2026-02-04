# Deploy the Marketing Site to Vercel

This guide sets up a **separate Vercel project** for the LeadMarka marketing/landing site (static HTML in `leadmarka-crm/marketing`). Your CRM app (frontend + backend) can stay in their own Vercel projects.

---

## 1. Create the Vercel project

1. Go to **[https://vercel.com/new](https://vercel.com/new)**.
2. **Import** your Git repository (the one containing `leadmarka-crm`).
3. If you don’t see it, use **“Enter a Git repository URL”** and paste your repo URL, then **Continue**.

---

## 2. Configure the project

On the **Configure Project** screen:

| Field | Value |
|--------|--------|
| **Project Name** | `leadmarka-marketing` (or e.g. `leadmarka-site`) |
| **Root Directory** | Click **Edit** → set to **`leadmarka-crm/marketing`** |
| **Framework Preset** | Other (or leave as is) |
| **Build Command** | Leave empty (static site, no build) |
| **Output Directory** | Leave empty or `.` (Vercel will serve the root) |
| **Install Command** | Leave empty |

No environment variables are required for the static marketing site.

---

## 3. Deploy

- Click **Deploy**.
- When the build finishes, the site will be live at `https://<your-project>.vercel.app`.

---

## 4. Optional: custom domain

- In the project → **Settings** → **Domains**, add your domain (e.g. `leadmarka.com` or `www.leadmarka.com`).
- Point DNS to Vercel as instructed.

---

## 5. Point links to your real app

The marketing pages use placeholder app URLs. After deployment, either:

- **Option A:** Edit `leadmarka-crm/marketing/index.html` and replace:
  - `https://app.leadmarka.com` with your real CRM app URL (e.g. `https://your-frontend.vercel.app`).
  - Update **Log in**, **Get started free**, **Terms**, and **Privacy** links to match your app’s paths (e.g. `/login`, `/register`, `/terms`, `/privacy`).

- **Option B:** Use a custom domain for the app (e.g. `app.leadmarka.com`) and leave the links as-is once the app is deployed there.

---

## Other hosts (Netlify, GitHub Pages, etc.)

The marketing site is static (HTML + CSS + one SVG). You can deploy it anywhere:

- **Netlify:** New site from Git → root directory `leadmarka-crm/marketing` → no build command → deploy.
- **GitHub Pages:** Use the same folder as the source (e.g. with GitHub Actions or a branch that only contains the `marketing` output).
- **Cloudflare Pages:** Connect repo, set root to `leadmarka-crm/marketing`, no build.

No environment variables or build step are required.
