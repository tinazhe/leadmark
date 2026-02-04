// Minimal Sentry setup (production + DSN only)
import * as Sentry from '@sentry/react';

export function initSentry() {
  const dsn = process.env.REACT_APP_SENTRY_DSN;
  if (process.env.NODE_ENV !== 'production' || !dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    // Keep PII off by default; capture minimal context.
    sendDefaultPii: false,
  });
}

