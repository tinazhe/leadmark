const supabase = require('../config/supabase');

const logActivity = async ({ leadId, userId, action, metadata }) => {
  if (!leadId || !action) return;
  try {
    await supabase
      .from('activity_logs')
      .insert([{
        lead_id: leadId,
        user_id: userId || null,
        action,
        metadata: metadata || {},
      }]);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

module.exports = {
  logActivity,
};
