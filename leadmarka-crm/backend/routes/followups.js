const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { getDateStringInTimeZone, resolveTimeZone, DEFAULT_TIMEZONE } = require('../utils/timezone');

const router = express.Router();

const pad2 = (value) => String(value).padStart(2, '0');

const formatLocalDate = (date) => (
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
);

const normalizeDateInput = (value) => {
  if (value === undefined || value === null) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatLocalDate(value);
  }
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  if (trimmed.includes('T')) {
    return trimmed.split('T')[0];
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return formatLocalDate(parsed);
  }

  return trimmed;
};

const normalizeTimeInput = (value) => {
  if (value === undefined || value === null) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${pad2(value.getHours())}:${pad2(value.getMinutes())}`;
  }
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    return `${pad2(timeMatch[1])}:${timeMatch[2]}`;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
  }

  return trimmed;
};

// Get all follow-ups for a lead
router.get('/lead/:leadId', authMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const userId = req.userId;

    // Verify lead belongs to user
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('user_id', userId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { data: followUps, error } = await supabase
      .from('follow_ups')
      .select('*')
      .eq('lead_id', leadId)
      .eq('user_id', userId)
      .order('follow_up_date', { ascending: true })
      .order('follow_up_time', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    const userTimeZone = profileError ? DEFAULT_TIMEZONE : resolveTimeZone(profile?.timezone);
    const todayStr = getDateStringInTimeZone(new Date(), userTimeZone);

    res.json(followUps.map(fu => {
      return {
        id: fu.id,
        leadId: fu.lead_id,
        date: fu.follow_up_date,
        time: fu.follow_up_time,
        note: fu.note,
        completed: fu.completed,
        isOverdue: !fu.completed && fu.follow_up_date < todayStr,
        isToday: !fu.completed && fu.follow_up_date === todayStr,
        createdAt: fu.created_at,
      };
    }));
  } catch (error) {
    console.error('Get follow-ups error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create follow-up
router.post('/', authMiddleware, [
  body('leadId').notEmpty().withMessage('Lead ID is required'),
  body('date')
    .customSanitizer(normalizeDateInput)
    .isDate({ format: 'YYYY-MM-DD', strictMode: true })
    .withMessage('Valid date is required (YYYY-MM-DD)'),
  body('time')
    .customSanitizer(normalizeTimeInput)
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid time is required (HH:MM)'),
  body('note').optional().trim().isLength({ max: 140 }).withMessage('Note must be 140 characters or less'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Follow-up validation errors:', errors.array());
      return res.status(400).json({ errors: errors.array() });
    }

    const { leadId, date, time, note } = req.body;
    const userId = req.userId;

    // Verify lead belongs to user
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id, name, phone_number')
      .eq('id', leadId)
      .eq('user_id', userId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { data: followUp, error } = await supabase
      .from('follow_ups')
      .insert([{
        lead_id: leadId,
        user_id: userId,
        follow_up_date: date,
        follow_up_time: time,
        note: note || null,
        completed: false,
        notified: false,
        // notification_claimed_at / notified_at omitted so create works before migration 2026-02-04_follow-ups-notification-columns.sql
      }])
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({
      id: followUp.id,
      leadId: followUp.lead_id,
      leadName: lead.name,
      leadPhone: lead.phone_number,
      date: followUp.follow_up_date,
      time: followUp.follow_up_time,
      note: followUp.note,
      completed: followUp.completed,
      createdAt: followUp.created_at,
    });
  } catch (error) {
    console.error('Create follow-up error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update follow-up
router.put('/:id', authMiddleware, [
  body('date')
    .optional()
    .customSanitizer(normalizeDateInput)
    .isDate({ format: 'YYYY-MM-DD', strictMode: true }),
  body('time')
    .optional()
    .customSanitizer(normalizeTimeInput)
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('note').optional().trim().isLength({ max: 140 }),
  body('completed').optional().isBoolean(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { date, time, note, completed } = req.body;
    const userId = req.userId;

    const updates = {};
    if (date !== undefined) updates.follow_up_date = date;
    if (time !== undefined) updates.follow_up_time = time;
    if (note !== undefined) updates.note = note;
    if (completed !== undefined) {
      updates.completed = completed;
      if (completed) {
        updates.notified = true; // Mark as notified when completed
        updates.notification_claimed_at = null;
        updates.notified_at = new Date().toISOString();
      }
    }
    const dateOrTimeUpdated = date !== undefined || time !== undefined;
    if ((dateOrTimeUpdated || completed === false) && completed !== true) {
      updates.notified = false; // Re-arm reminders when rescheduling or reopening
      updates.notification_claimed_at = null;
      updates.notified_at = null;
    }

    const { data: followUp, error } = await supabase
      .from('follow_ups')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !followUp) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }

    res.json({
      id: followUp.id,
      leadId: followUp.lead_id,
      date: followUp.follow_up_date,
      time: followUp.follow_up_time,
      note: followUp.note,
      completed: followUp.completed,
      updatedAt: followUp.updated_at,
    });
  } catch (error) {
    console.error('Update follow-up error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Mark follow-up as complete
router.patch('/:id/complete', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const { data: followUp, error } = await supabase
      .from('follow_ups')
      .update({ completed: true, notified: true, notification_claimed_at: null, notified_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error || !followUp) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }

    res.json({
      id: followUp.id,
      completed: followUp.completed,
      message: 'Follow-up marked as complete',
    });
  } catch (error) {
    console.error('Complete follow-up error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete follow-up
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const { error } = await supabase
      .from('follow_ups')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      return res.status(404).json({ error: 'Follow-up not found' });
    }

    res.json({ message: 'Follow-up deleted successfully' });
  } catch (error) {
    console.error('Delete follow-up error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
