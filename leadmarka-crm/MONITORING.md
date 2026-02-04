# Monitoring (Minimal)

This doc describes a **minimal** monitoring setup for LeadMarka:

- **Uptime monitoring** (ping a health endpoint)
- **Error tracking** (frontend + backend) using **Sentry**
- **Logs** (use your hosting provider logs; secrets are redacted in backend request logs)

## Uptime monitoring

### Health endpoint

The backend exposes a health endpoint:

- `GET https://<your-backend-host>/api/health`

Expected response:

```json
{ "status": "ok", "timestamp": "2026-01-01T00:00:00.000Z" }
```

### Uptime Robot (recommended)

Use [Uptime Robot](https://uptimerobot.com) (free tier) to ping the health URL every 5–15 minutes and alert you by email if it goes down.

## Error tracking (Sentry)

Sentry gives you visibility into runtime errors and crashes, both in the browser and on the server.

Create two Sentry projects:

- **Frontend**: JavaScript (React)
- **Backend**: Node.js (Express)

### Frontend configuration

Set this env var for your frontend deployment:

- `REACT_APP_SENTRY_DSN` = your Sentry DSN

Notes:

- Sentry is only initialized in **production** builds and only if the DSN is set.

### Backend configuration

Set this env var for your backend deployment:

- `SENTRY_DSN` = your Sentry DSN

Notes:

- Sentry is only initialized when `SENTRY_DSN` is set.
- Backend request logging already redacts sensitive keys (passwords/tokens/secrets).

## Logs

- **Backend logs**: view via your host provider (Vercel / Render / Railway logs, etc.).\n+- **Redaction**: backend request logs redact common secret keys; avoid adding secrets to URLs or query params where possible.

