// Catch load-time errors (e.g. missing SUPABASE_URL/SUPABASE_SERVICE_KEY) so the
// serverless function responds with 503 instead of crashing with FUNCTION_INVOCATION_FAILED.
let app;
let loadError;
try {
  app = require('../app');
} catch (err) {
  loadError = err;
  console.error('Backend failed to load:', err?.message || err);
}

// Serverless: prevent FUNCTION_INVOCATION_FAILED from unhandled rejections.
// (server.js registers these for local dev; Vercel only loads this file.)
function registerProcessErrorHandlers() {
  if (process.listenerCount && process.listenerCount('unhandledRejection') > 0) return;
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    console.error('Unhandled rejection:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    try {
      const { captureException } = require('../sentry');
      captureException(err);
    } catch (_) {
      // ignore
    }
  });
  process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    try {
      const { captureException } = require('../sentry');
      captureException(err);
    } catch (_) {
      // ignore
    }
    process.exit(1);
  });
}

/** Wait for Express to finish the response (or error). Prevents the serverless
 *  handler from returning before res.end(), which can cause FUNCTION_INVOCATION_FAILED. */
function waitForResponse(req, res) {
  return new Promise((resolve, reject) => {
    const onDone = () => {
      res.removeListener('finish', onDone);
      res.removeListener('close', onDone);
      res.removeListener('error', onError);
      resolve();
    };
    const onError = (err) => {
      res.removeListener('finish', onDone);
      res.removeListener('close', onDone);
      res.removeListener('error', onError);
      reject(err);
    }
    res.once('finish', onDone);
    res.once('close', onDone);
    res.once('error', onError);
  });
}

module.exports = async function handler(req, res) {
  registerProcessErrorHandlers();

  if (loadError) {
    res.status(503).json({
      error: 'Configuration error',
      message: loadError.message || 'Server failed to load. Check Vercel env vars (e.g. SUPABASE_URL, SUPABASE_SERVICE_KEY).',
    });
    return;
  }

  const responseDone = waitForResponse(req, res);
  try {
    app(req, res);
    await responseDone;
  } catch (err) {
    console.error('Unhandled handler error:', err?.message || err);
    if (err?.stack) console.error(err.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

