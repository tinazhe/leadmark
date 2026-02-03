const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { getDateStringInTimeZone, resolveTimeZone, DEFAULT_TIMEZONE } = require('../utils/timezone');

const router = express.Router();

// Today Dashboard - Get follow-ups due today and overdue
router.get('/today', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .single();

    const userTimeZone = profileError ? DEFAULT_TIMEZONE : resolveTimeZone(profile?.timezone);
    const todayStr = getDateStringInTimeZone(new Date(), userTimeZone);

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
      today: todayFollowUps.map(formatFollowUp),
      overdue: overdueFollowUps.map(formatFollowUp),
      summary: {
        todayCount: todayFollowUps.length,
        overdueCount: overdueFollowUps.length,
        totalActionRequired: todayFollowUps.length + overdueFollowUps.length,
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Quick stats for dashboard header
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
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
      { count: interestedLeads, error: interestedError },
      { count: followUpLeads, error: followUpError },
      { count: wonLeads, error: wonError },
      { count: lostLeads, error: lostError },
      { count: todayFollowUps, error: todayFuError },
      { count: overdueFollowUps, error: overdueFuError },
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'new'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'interested'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'follow-up'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'won'),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'lost'),
      supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', false).eq('follow_up_date', today),
      supabase.from('follow_ups').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('completed', false).lt('follow_up_date', today),
    ]);

    if (leadsError || newError || interestedError || followUpError || wonError || lostError) {
      return res.status(400).json({ error: 'Error fetching stats' });
    }

    res.json({
      leads: {
        total: totalLeads || 0,
        byStatus: {
          new: newLeads || 0,
          interested: interestedLeads || 0,
          followUp: followUpLeads || 0,
          won: wonLeads || 0,
          lost: lostLeads || 0,
        },
      },
      followUps: {
        today: todayFollowUps || 0,
        overdue: overdueFollowUps || 0,
        totalPending: (todayFollowUps || 0) + (overdueFollowUps || 0),
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
