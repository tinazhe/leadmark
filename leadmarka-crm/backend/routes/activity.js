const express = require('express');
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');
const { workspaceMiddleware } = require('../middleware/workspace');
const { subscriptionMiddleware } = require('../middleware/subscription');
const { fetchProfilesByIds } = require('../utils/workspace');

const router = express.Router();

router.get('/lead/:leadId', authMiddleware, workspaceMiddleware, subscriptionMiddleware, async (req, res) => {
  try {
    const { leadId } = req.params;
    const ownerId = req.workspaceOwnerId;

    // Use workspaceOwnerId so members can load activity for workspace leads.
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('user_id', ownerId)
      .single();

    if (leadError || !lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { data: logs, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const userIds = Array.from(new Set((logs || []).map((log) => log.user_id).filter(Boolean)));
    const profiles = await fetchProfilesByIds(userIds);
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

    res.json((logs || []).map((log) => {
      const profile = profileById.get(log.user_id) || null;
      return {
        id: log.id,
        leadId: log.lead_id,
        action: log.action,
        metadata: log.metadata || {},
        createdAt: log.created_at,
        user: profile
          ? {
              id: profile.id,
              fullName: profile.full_name,
              businessName: profile.business_name,
            }
          : null,
      };
    }));
  } catch (error) {
    console.error('Activity log error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
