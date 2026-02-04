const express = require('express');
const { runCronCycle } = require('../services/reminderService');

const router = express.Router();

// Secret required to trigger cron (set CRON_SECRET in env). Prefer header; query supported for cron-job.org.
const getCronSecret = (req) =>
  req.get('Authorization')?.replace(/^Bearer\s+/i, '').trim() || req.query?.secret || '';

router.get('/reminders', async (req, res) => {
  const secret = getCronSecret(req);
  const expected = process.env.CRON_SECRET;

  if (!expected || secret !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await runCronCycle();
    res.json({ ok: true, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('Cron reminders error:', err);
    res.status(500).json({ error: 'Cron failed', timestamp: new Date().toISOString() });
  }
});

module.exports = router;
