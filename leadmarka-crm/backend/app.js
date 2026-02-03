const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables (Vercel/production will typically provide env vars directly)
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/followups', followUpRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

module.exports = app;

