let Sentry = null;

const shouldRedactKey = (key) => {
  if (!key || typeof key !== 'string') return false;
  return /(pass(word)?|token|secret|api[_-]?key|authorization|refresh[_-]?token|access[_-]?token|jwt)/i.test(key);
};

const sanitizeForLog = (value, depth = 0) => {
  if (depth > 4) return '[Truncated]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 200) return `${value.slice(0, 200)}…[Truncated]`;
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    if (value.length > 50) return [...value.slice(0, 50).map((item) => sanitizeForLog(item, depth + 1)), '[Truncated]'];
    return value.map((item) => sanitizeForLog(item, depth + 1));
  }

  const output = {};
  for (const [key, child] of Object.entries(value)) {
    output[key] = shouldRedactKey(key) ? '[REDACTED]' : sanitizeForLog(child, depth + 1);
  }
  return output;
};

function initSentry() {
  if (!process.env.SENTRY_DSN) return;
  // Lazy require so local dev without DSN stays lightweight.
  // eslint-disable-next-line global-require
  Sentry = require('@sentry/node');

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      // Best-effort redaction if request data exists.
      if (event?.request?.data) {
        event.request.data = sanitizeForLog(event.request.data);
      }
      return event;
    },
  });
}

function captureException(error, req) {
  if (!Sentry) return;

  Sentry.withScope((scope) => {
    if (req) {
      scope.setContext('request', {
        method: req.method,
        url: req.originalUrl,
        params: sanitizeForLog(req.params),
        query: sanitizeForLog(req.query),
        body: sanitizeForLog(req.body),
      });
    }
    scope.setLevel('error');
    Sentry.captureException(error);
  });
}

module.exports = {
  initSentry,
  captureException,
};

