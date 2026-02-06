const supabase = require('../config/supabase');

const resolveWorkspaceContext = async (userId) => {
  if (!userId) {
    return { ownerId: null, role: null };
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .select('owner_id, role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return { ownerId: userId, role: 'owner' };
  }

  return { ownerId: data.owner_id, role: data.role };
};

const workspaceMiddleware = async (req, res, next) => {
  try {
    const context = await resolveWorkspaceContext(req.userId);
    req.workspaceOwnerId = context.ownerId;
    req.workspaceRole = context.role;
    next();
  } catch (error) {
    console.error('Workspace middleware error:', error);
    return res.status(500).json({ error: 'Workspace resolution failed' });
  }
};

module.exports = {
  workspaceMiddleware,
  resolveWorkspaceContext,
};
