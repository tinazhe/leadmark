const app = require('./app');
const { initSentry, captureException } = require('./sentry');
const { validatePaynowConfig } = require('./config/paynow');

initSentry();

// Validate Paynow configuration on startup
try {
  validatePaynowConfig();
} catch (err) {
  console.error('❌ Paynow configuration validation failed:');
  console.error(err.message);
  if (process.env.NODE_ENV === 'production') {
    console.error('Server cannot start with invalid Paynow configuration in production.');
    process.exit(1);
  } else {
    console.warn('⚠️  WARNING: Continuing in development mode with invalid Paynow config.');
  }
}


process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  console.error('Unhandled rejection:', err);
  captureException(err);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  captureException(err);
  // eslint-disable-next-line no-process-exit
  process.exit(1);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
