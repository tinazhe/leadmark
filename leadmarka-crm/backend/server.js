const app = require('./app');
const { initSentry, captureException } = require('./sentry');

initSentry();

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  captureException(err);
});

process.on('uncaughtException', (err) => {
  captureException(err);
  // eslint-disable-next-line no-process-exit
  process.exit(1);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
