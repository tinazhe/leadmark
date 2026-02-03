const dotenv = require('dotenv');

dotenv.config();

const { scheduleReminders } = require('./services/reminderService');

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection in worker:', reason);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception in worker:', err);
  process.exit(1);
});

scheduleReminders();
