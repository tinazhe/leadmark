const express = require('express');
require('express-async-errors');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables (Vercel/production will typically provide env vars directly)
dotenv.config();

const app = express();

// CORS: allow frontend origins (production + dev). FRONTEND_URL from env for flexibility.
const allowedOrigins = [
  'https://app.leadmarka.co.zw',
  'http://localhost:3000',
  'http://localhost:5173',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

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

// Request logger (never log secrets / passwords)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd && req.method !== 'GET') {
    console.log(`${timestamp} - ${req.method} ${req.url}`, sanitizeForLog(req.body));
  } else {
    console.log(`${timestamp} - ${req.method} ${req.url}`);
  }

  next();
});

// Import routes
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const followUpRoutes = require('./routes/followups');
const noteRoutes = require('./routes/notes');
const dashboardRoutes = require('./routes/dashboard');
const cronRoutes = require('./routes/cron');
const adminRoutes = require('./routes/admin');
const workspaceRoutes = require('./routes/workspace');
const activityRoutes = require('./routes/activity');
const billingRoutes = require('./routes/billing');

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/cron', cronRoutes);
// Vercel rewrite may pass path without /api prefix; accept both so cron-job.org works
app.use('/cron', cronRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/billing', billingRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback error handler (captures thrown errors that reach Express)
// Note: most routes handle their own errors, but this protects against unexpected throws.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  try {
    // Lazy load to avoid circular deps / startup overhead without DSN.
    // eslint-disable-next-line global-require
    const { captureException } = require('./sentry');
    captureException(err, req);
  } catch (_) {
    // ignore
  }
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

