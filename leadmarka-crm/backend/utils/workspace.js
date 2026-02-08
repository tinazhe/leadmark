const supabase = require('../config/supabase');

const getWorkspaceOwnerId = async (userId) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('workspace_members')
    .select('owner_id, role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return userId;
  }

  return data.owner_id;
};

const getWorkspaceRole = async (userId) => {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return 'owner';
  }

  return data.role;
};

const getWorkspaceMemberIds = async (ownerId) => {
  if (!ownerId) return [];
  const { data, error } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('owner_id', ownerId);

  if (error || !data) return [];
  return data.map((row) => row.user_id);
};

const fetchProfilesByIds = async (userIds) => {
  if (!userIds || userIds.length === 0) return [];
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, business_name, timezone')
    .in('id', userIds);

  if (error || !data) return [];
  return data;
};

module.exports = {
  getWorkspaceOwnerId,
  getWorkspaceRole,
  getWorkspaceMemberIds,
  fetchProfilesByIds,
};
