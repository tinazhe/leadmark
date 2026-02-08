const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { workspaceMiddleware } = require('../middleware/workspace');
const { subscriptionMiddleware } = require('../middleware/subscription');
const { getDateStringInTimeZone, resolveTimeZone, DEFAULT_TIMEZONE } = require('../utils/timezone');

const router = express.Router();

// Today Dashboard - Get follow-ups due today and overdue
router.get('/today', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const ownerId = req.workspaceOwnerId;
    const { data: assignedLeads, error: assignedLeadsError } = await supabase
      .from('leads')
      .select('id')
      .eq('user_id', ownerId)
      .eq('assigned_user_id', userId);

    if (assignedLeadsError) {
      console.warn('Assigned leads lookup failed:', assignedLeadsError.message);
    }

    const assignedLeadIds = assignedLeadsError ? [] : (assignedLeads || []).map((lead) => lead.id);
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    const userTimeZone = profileError ? DEFAULT_TIMEZONE : resolveTimeZone(profile?.timezone);
    const todayStr = getDateStringInTimeZone(new Date(), userTimeZone);

    // Total leads (used for first-time dashboard empty state)
    const { count: leadCount, error: leadCountError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ownerId);

    if (leadCountError) {
      return res.status(400).json({ error: leadCountError.message });
    }

    // Get follow-ups due today (not completed)
    const { data: todayFollowUps, error: todayError } = await supabase
      .from('follow_ups')
      .select(`
        *,
        lead:leads(id, name, phone_number, status)
      `)
      .eq('user_id', userId)
      .eq('completed', false)
      .eq('follow_up_date', todayStr)
      .order('follow_up_time', { ascending: true });

    if (todayError) {
      return res.status(400).json({ error: todayError.message });
    }

    // Get overdue follow-ups (not completed, date < today)
    const { data: overdueFollowUps, error: overdueError } = await supabase
      .from('follow_ups')
      .select(`
        *,
        lead:leads(id, name, phone_number, status)
      `)
      .eq('user_id', userId)
      .eq('completed', false)
      .lt('follow_up_date', todayStr)
      .order('follow_up_date', { ascending: true })
      .order('follow_up_time', { ascending: true });

    if (overdueError) {
      return res.status(400).json({ error: overdueError.message });
    }

    let assignedTodayFollowUps = [];
    let assignedOverdueFollowUps = [];

    if (assignedLeadIds.length > 0) {
      const { data: assignedToday, error: assignedTodayError } = await supabase
        .from('follow_ups')
        .select(`
          *,
          lead:leads(id, name, phone_number, status)
        `)
        .in('lead_id', assignedLeadIds)
        .eq('completed', false)
        .eq('follow_up_date', todayStr)
        .order('follow_up_time', { ascending: true });

      const { data: assignedOverdue, error: assignedOverdueError } = await supabase
        .from('follow_ups')
        .select(`
          *,
          lead:leads(id, name, phone_number, status)
        `)
        .in('lead_id', assignedLeadIds)
        .eq('completed', false)
        .lt('follow_up_date', todayStr)
        .order('follow_up_date', { ascending: true })
        .order('follow_up_time', { ascending: true });

      if (assignedTodayError) {
        console.warn('Assigned today follow-ups lookup failed:', assignedTodayError.message);
      } else {
        assignedTodayFollowUps = assignedToday || [];
      }

      if (assignedOverdueError) {
        console.warn('Assigned overdue follow-ups lookup failed:', assignedOverdueError.message);
      } else {
        assignedOverdueFollowUps = assignedOverdue || [];
      }
    }

    const combinedToday = [...(todayFollowUps || []), ...assignedTodayFollowUps];
    const combinedOverdue = [...(overdueFollowUps || []), ...assignedOverdueFollowUps];
    const dedupeById = (rows) => {
      const seen = new Set();
      return rows.filter((row) => {
        if (seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      });
    };

    const uniqueToday = dedupeById(combinedToday);
    const uniqueOverdue = dedupeById(combinedOverdue);

    // Format response
    const formatFollowUp = (fu) => ({
      id: fu.id,
      leadId: fu.lead_id,
      leadName: fu.lead.name,
      leadPhone: fu.lead.phone_number,
      leadStatus: fu.lead.status ? fu.lead.status.toLowerCase() : fu.lead.status,
      date: fu.follow_up_date,
      time: fu.follow_up_time,
      note: fu.note,
      whatsappUrl: `https://wa.me/${fu.lead.phone_number.replace(/\D/g, '')}`,
    });

    res.json({
      today: uniqueToday.map(formatFollowUp),
      overdue: uniqueOverdue.map(formatFollowUp),
      leadCount: leadCount || 0,
      summary: {
        todayCount: uniqueToday.length,
        overdueCount: uniqueOverdue.length,
        totalActionRequired: uniqueToday.length + uniqueOverdue.length,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Quick stats for dashboard header
router.get('/stats', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const ownerId = req.workspaceOwnerId;
    const { data: assignedLeads, error: assignedLeadsError } = await supabase
      .from('leads')
      .select('id')
      .eq('user_id', ownerId)
      .eq('assigned_user_id', userId);

    if (assignedLeadsError) {
      console.warn('Assigned leads lookup failed:', assignedLeadsError.message);
    }

    const assignedLeadIds = assignedLeadsError ? [] : (assignedLeads || []).map((lead) => lead.id);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    const userTimeZone = profileError ? DEFAULT_TIMEZONE : resolveTimeZone(profile?.timezone);
    const today = getDateStringInTimeZone(new Date(), userTimeZone);

    // Get counts
    const [
      { count: totalLeads, error: leadsError },
      { count: newLeads, error: newError },
      { count: contactedLeads, error: contactedError },
      { count: quotedLeads, error: quotedError },
      { count: followUpLeads, error: followUpError },
      { count: negotiatingLeads, error: negotiatingError },
      { count: wonLeads, error: wonError },
      { count: lostLeads, error: lostError },
      { data: todayByOwner, error: todayOwnerError },
      { data: overdueByOwner, error: overdueOwnerError },
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', ownerId),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', ownerId),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'new'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'contacted'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'quoted'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'follow-up'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'negotiating'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'won'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', ownerId).eq('status', 'lost'),
      supabase
        .from('follow_ups')
        .select('id')
        .eq('user_id', userId)
        .eq('completed', false)
        .eq('follow_up_date', today),
      supabase
        .from('follow_ups')
        .select('id')
        .eq('user_id', userId)
        .eq('completed', false)
        .lt('follow_up_date', today),
    ]);

    if (leadsError || newError || contactedError || quotedError || followUpError || negotiatingError || wonError || lostError || todayOwnerError || overdueOwnerError) {
      return res.status(400).json({ error: 'Error fetching stats' });
    }

    let todayIds = (todayByOwner || []).map((row) => row.id);
    let overdueIds = (overdueByOwner || []).map((row) => row.id);

    if (assignedLeadIds.length > 0) {
      const [{ data: todayAssigned, error: todayAssignedError }, { data: overdueAssigned, error: overdueAssignedError }] = await Promise.all([
        supabase
          .from('follow_ups')
          .select('id')
          .in('lead_id', assignedLeadIds)
          .eq('completed', false)
          .eq('follow_up_date', today),
        supabase
          .from('follow_ups')
          .select('id')
          .in('lead_id', assignedLeadIds)
          .eq('completed', false)
          .lt('follow_up_date', today),
      ]);

      if (todayAssignedError) {
        console.warn('Assigned today stats lookup failed:', todayAssignedError.message);
      } else {
        todayIds = todayIds.concat((todayAssigned || []).map((row) => row.id));
      }

      if (overdueAssignedError) {
        console.warn('Assigned overdue stats lookup failed:', overdueAssignedError.message);
      } else {
        overdueIds = overdueIds.concat((overdueAssigned || []).map((row) => row.id));
      }
    }

    const uniqueTodayCount = new Set(todayIds).size;
    const uniqueOverdueCount = new Set(overdueIds).size;

    res.json({
      leads: {
        total: totalLeads || 0,
        byStatus: {
          new: newLeads || 0,
          contacted: contactedLeads || 0,
          quoted: quotedLeads || 0,
          followUp: followUpLeads || 0,
          negotiating: negotiatingLeads || 0,
          won: wonLeads || 0,
          lost: lostLeads || 0,
        },
      },
      followUps: {
        today: uniqueTodayCount || 0,
        overdue: uniqueOverdueCount || 0,
        totalPending: (uniqueTodayCount || 0) + (uniqueOverdueCount || 0),
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
