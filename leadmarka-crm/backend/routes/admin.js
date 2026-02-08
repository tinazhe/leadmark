const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/supabase');

const router = express.Router();

const safeEqual = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
};

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
};

const parseAdminEmails = (value) => {
  if (!value || typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
};

const adminAuth = async (req, res, next) => {
  try {
    const configuredAdminKey = process.env.ADMIN_API_KEY;
    const configuredAdminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);

    // Prefer API key auth if configured.
    if (configuredAdminKey) {
      const headerKey = req.headers['x-admin-key'];
      const candidate =
        (typeof headerKey === 'string' ? headerKey : null) || getBearerToken(req);

      if (!candidate || !safeEqual(candidate, configuredAdminKey)) {
        console.warn('Admin analytics unauthorized (api-key)');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      req.isAdmin = true;
      return next();
    }

    // Fallback: allowlisted admin emails via existing JWT.
    if (configuredAdminEmails.length > 0) {
      const token = getBearerToken(req);
      if (!token) {
        console.warn('Admin analytics unauthorized (no-token)');
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const email = (decoded?.email || '').toString().trim().toLowerCase();

      if (!email || !configuredAdminEmails.includes(email)) {
        console.warn('Admin analytics forbidden (email)');
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.isAdmin = true;
      req.adminEmail = email;
      return next();
    }

    console.warn('Admin analytics not configured');
    return res.status(503).json({ error: 'Admin analytics not configured' });
  } catch (error) {
    console.error('Admin auth error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
};

const isoDaysAgo = (days) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const countExact = async (queryPromise) => {
  const { count, error } = await queryPromise;
  if (error) throw error;
  return count || 0;
};

const fetchCreatedAtSeriesByDay = async ({ table, days }) => {
  const cutoffIso = isoDaysAgo(days);
  const { data, error } = await supabase
    .from(table)
    .select('created_at')
    .gte('created_at', cutoffIso)
    .order('created_at', { ascending: true })
    .limit(10000);

  if (error) throw error;

  const counts = new Map();
  for (const row of data || []) {
    const date = typeof row.created_at === 'string' ? row.created_at.slice(0, 10) : null;
    if (!date) continue;
    counts.set(date, (counts.get(date) || 0) + 1);
  }

  // Fill missing dates with 0.
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: counts.get(key) || 0 });
  }
  return out;
};

const countDistinctColumn = async ({ table, column, pageSize = 1000, maxRows = 50000 }) => {
  const seen = new Set();
  let offset = 0;
  let truncated = false;

  // Pagination to avoid pulling everything at once.
  while (offset < maxRows) {
    const { data, error } = await supabase
      .from(table)
      .select(column)
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    for (const row of data || []) {
      const v = row?.[column];
      if (v) seen.add(v);
    }

    if (!data || data.length < pageSize) break;
    offset += pageSize;
  }

  if (offset >= maxRows) truncated = true;

  return { count: seen.size, truncated };
};

// Admin Analytics
router.get('/analytics', adminAuth, async (req, res) => {
  const startedAt = Date.now();

  try {
    const cutoff7 = isoDaysAgo(7);
    const cutoff30 = isoDaysAgo(30);

    const statuses = ['new', 'contacted', 'quoted', 'follow-up', 'negotiating', 'won', 'lost'];

    const [
      totalUsers,
      signupsLast7Days,
      signupsLast30Days,
      totalLeads,
      leadsLast7Days,
      leadsLast30Days,
      totalFollowUps,
      followUpsCompleted,
      followUpsPending,
      followUpsCreatedLast7Days,
      followUpsCreatedLast30Days,
      followUpsCompletedLast7Days,
      followUpsCompletedLast30Days,
      totalNotes,
      notesLast7Days,
      notesLast30Days,
      usersReminderEnabled,
      usersDailySummaryEnabled,
      leadsWithWhatsappContact,
      leadsWithConversationLabel,
    ] = await Promise.all([
      countExact(supabase.from('profiles').select('*', { count: 'exact', head: true })),
      countExact(supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', cutoff7)),
      countExact(supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', cutoff30)),
      countExact(supabase.from('leads').select('*', { count: 'exact', head: true })),
      countExact(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', cutoff7)),
      countExact(supabase.from('leads').select('*', { count: 'exact', head: true }).gte('created_at', cutoff30)),
      countExact(supabase.from('follow_ups').select('*', { count: 'exact', head: true })),
      countExact(supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('completed', true)),
      countExact(supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('completed', false)),
      countExact(supabase.from('follow_ups').select('*', { count: 'exact', head: true }).gte('created_at', cutoff7)),
      countExact(supabase.from('follow_ups').select('*', { count: 'exact', head: true }).gte('created_at', cutoff30)),
      countExact(
        supabase
          .from('follow_ups')
          .select('*', { count: 'exact', head: true })
          .eq('completed', true)
          .gte('updated_at', cutoff7)
      ),
      countExact(
        supabase
          .from('follow_ups')
          .select('*', { count: 'exact', head: true })
          .eq('completed', true)
          .gte('updated_at', cutoff30)
      ),
      countExact(supabase.from('notes').select('*', { count: 'exact', head: true })),
      countExact(supabase.from('notes').select('*', { count: 'exact', head: true }).gte('created_at', cutoff7)),
      countExact(supabase.from('notes').select('*', { count: 'exact', head: true }).gte('created_at', cutoff30)),
      countExact(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('reminder_enabled', true)),
      countExact(supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('daily_summary_enabled', true)),
      countExact(
        supabase.from('leads').select('*', { count: 'exact', head: true }).not('last_whatsapp_contact_at', 'is', null)
      ),
      countExact(
        supabase.from('leads').select('*', { count: 'exact', head: true }).not('conversation_label', 'is', null)
      ),
    ]);

    const leadsByStatusCounts = await Promise.all(
      statuses.map((status) =>
        countExact(supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', status))
      )
    );
    const leadsByStatus = statuses.reduce((acc, status, idx) => {
      acc[status] = leadsByStatusCounts[idx] || 0;
      return acc;
    }, {});

    const [signupsByDay, usersWithLeads, usersWithFollowUps, usersWithNotes] = await Promise.all([
      fetchCreatedAtSeriesByDay({ table: 'profiles', days: 30 }),
      countDistinctColumn({ table: 'leads', column: 'user_id' }),
      countDistinctColumn({ table: 'follow_ups', column: 'user_id' }),
      countDistinctColumn({ table: 'notes', column: 'user_id' }),
    ]);

    const durationMs = Date.now() - startedAt;
    console.log(`Admin analytics ok (${durationMs}ms)`);

    res.json({
      users: {
        total: totalUsers,
        engagement: {
          usersWithLeads: usersWithLeads.count,
          usersWithFollowUps: usersWithFollowUps.count,
          usersWithNotes: usersWithNotes.count,
        },
        featureAdoption: {
          reminderEnabled: usersReminderEnabled,
          dailySummaryEnabled: usersDailySummaryEnabled,
        },
      },
      signups: {
        total: totalUsers,
        last7Days: signupsLast7Days,
        last30Days: signupsLast30Days,
        byDayLast30Days: signupsByDay.map((d) => ({ date: d.date, signups: d.count })),
      },
      leads: {
        total: totalLeads,
        last7Days: leadsLast7Days,
        last30Days: leadsLast30Days,
        byStatus: leadsByStatus,
        withWhatsappContact: leadsWithWhatsappContact,
        withConversationLabel: leadsWithConversationLabel,
      },
      followUps: {
        total: totalFollowUps,
        completed: followUpsCompleted,
        pending: followUpsPending,
        createdLast7Days: followUpsCreatedLast7Days,
        createdLast30Days: followUpsCreatedLast30Days,
        completedLast7Days: followUpsCompletedLast7Days,
        completedLast30Days: followUpsCompletedLast30Days,
      },
      notes: {
        total: totalNotes,
        last7Days: notesLast7Days,
        last30Days: notesLast30Days,
      },
      meta: {
        engagementCountsTruncated: {
          leads: usersWithLeads.truncated,
          followUps: usersWithFollowUps.truncated,
          notes: usersWithNotes.truncated,
        },
      },
    });
  } catch (error) {
    console.error('Admin analytics error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/admin/subscriptions/comp — grant free access to a workspace
// ──────────────────────────────────────────────────────────────
router.post('/subscriptions/comp', adminAuth, [
  body('ownerId').trim().notEmpty().withMessage('ownerId is required'),
  body('compedUntil').optional().isISO8601().withMessage('compedUntil must be ISO 8601'),
  body('compedReason').optional().trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ownerId, compedUntil, compedReason } = req.body;

    // Default: comp for 10 years (effectively indefinite)
    const until = compedUntil || new Date(Date.now() + 10 * 365.25 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('workspace_subscriptions')
      .upsert([{
        owner_id: ownerId,
        comped_until: until,
        comped_reason: compedReason || null,
        comped_by: req.adminEmail || 'admin',
        status: 'active',
        updated_at: new Date().toISOString(),
      }], { onConflict: 'owner_id' })
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log(`Workspace ${ownerId} comped until ${until} by ${req.adminEmail || 'admin'}`);
    res.json({ status: 'comped', ownerId, compedUntil: until, subscription: data });
  } catch (error) {
    console.error('Admin comp error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/subscriptions/remove-comp — remove comp from a workspace
router.post('/subscriptions/remove-comp', adminAuth, [
  body('ownerId').trim().notEmpty().withMessage('ownerId is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { ownerId } = req.body;

    const { data, error } = await supabase
      .from('workspace_subscriptions')
      .update({
        comped_until: null,
        comped_reason: null,
        comped_by: null,
        updated_at: new Date().toISOString(),
      })
      .eq('owner_id', ownerId)
      .select()
      .single();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    console.log(`Comp removed from workspace ${ownerId} by ${req.adminEmail || 'admin'}`);
    res.json({ status: 'comp_removed', ownerId, subscription: data });
  } catch (error) {
    console.error('Admin remove-comp error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

