import React, { useEffect, useState } from 'react';
import { Loader2, Mail, Plus, Trash2, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SettingsShell from './SettingsShell';
import { workspaceAPI } from '../../services/api';

const TeamSettings = () => {
  const { user } = useAuth();
  const teamInboxEnabled = Boolean(user?.teamInboxEnabled);
  const isOwner = user?.role === 'owner';

  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [pendingInvites, setPendingInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState('');

  useEffect(() => {
    let active = true;
    const loadMembers = async () => {
      if (!teamInboxEnabled) return;
      setTeamLoading(true);
      setTeamError('');
      try {
        const { data } = await workspaceAPI.getMembers();
        if (active) setTeamMembers(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) {
          const msg = err?.response?.data?.error || err?.message || 'Failed to load team';
          setTeamError(typeof msg === 'string' ? msg : 'Failed to load team');
        }
      } finally {
        if (active) setTeamLoading(false);
      }
    };
    loadMembers();
    return () => {
      active = false;
    };
  }, [teamInboxEnabled]);

  useEffect(() => {
    let active = true;
    const loadInvites = async () => {
      if (!teamInboxEnabled || !isOwner) return;
      setInvitesLoading(true);
      setInvitesError('');
      try {
        const { data } = await workspaceAPI.getInvites();
        if (active) setPendingInvites(Array.isArray(data) ? data : []);
      } catch (err) {
        if (active) {
          const status = err?.response?.status;
          if (status === 404) {
            setPendingInvites([]);
            setInvitesError('');
          } else {
            const msg = err?.response?.data?.error || err?.message || 'Failed to load invites';
            setInvitesError(typeof msg === 'string' ? msg : 'Failed to load invites');
          }
        }
      } finally {
        if (active) setInvitesLoading(false);
      }
    };
    loadInvites();
    return () => {
      active = false;
    };
  }, [teamInboxEnabled, isOwner]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setTeamError('');
    setInviteSuccess('');
    try {
      const emailToInvite = inviteEmail.trim();
      await workspaceAPI.invite(emailToInvite);
      setInviteEmail('');
      setInviteSuccess(`Invitation sent to ${emailToInvite}`);
      setTimeout(() => setInviteSuccess(''), 3000);
      const { data } = await workspaceAPI.getMembers();
      setTeamMembers(Array.isArray(data) ? data : []);
      if (isOwner) {
        try {
          const inviteRes = await workspaceAPI.getInvites();
          setPendingInvites(Array.isArray(inviteRes?.data) ? inviteRes.data : []);
        } catch (err) {
          if (err?.response?.status !== 404) {
            const msg = err?.response?.data?.error || err?.message || 'Failed to load invites';
            setInvitesError(typeof msg === 'string' ? msg : 'Failed to load invites');
          }
        }
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to invite member';
      setTeamError(typeof msg === 'string' ? msg : 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Remove this member from the workspace?')) return;
    setTeamError('');
    try {
      await workspaceAPI.removeMember(memberId);
      const { data } = await workspaceAPI.getMembers();
      setTeamMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to remove member';
      setTeamError(typeof msg === 'string' ? msg : 'Failed to remove member');
    }
  };

  if (!teamInboxEnabled) {
    return (
      <SettingsShell
        title="Team"
        description="Team access is currently disabled for this workspace."
      >
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
          Team collaboration is not enabled yet. Reach out to support if you need multi-user access.
        </div>
      </SettingsShell>
    );
  }

  return (
    <SettingsShell
      title="Team"
      description="Manage members, roles, and invitations."
    >
      <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-gray-400" />
            Members
          </h3>
          <span className="text-xs text-gray-500 uppercase tracking-wide">
            {isOwner ? 'Owner' : 'Member'}
          </span>
        </div>

        {teamError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
            {teamError}
          </div>
        )}
        {inviteSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
            {inviteSuccess}
          </div>
        )}

        {teamLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading team...
          </div>
        ) : (
          <div className="space-y-2">
            {teamMembers.length === 0 ? (
              <p className="text-sm text-gray-500">No team members yet.</p>
            ) : (
              teamMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {member.fullName || member.email || 'Team member'}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      {member.email || ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 uppercase tracking-wide">
                      {member.role}
                    </span>
                    {isOwner && member.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.userId)}
                        className="p-1.5 text-gray-400 hover:text-danger-600 hover:bg-danger-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {isOwner && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Invite member
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(event) => setInviteEmail(event.target.value)}
                  placeholder="teammate@example.com"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                />
              </div>
              <button
                type="button"
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {inviting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Inviting...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Invite
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Pending invitations</h3>
            {invitesLoading && (
              <span className="text-xs text-gray-500">Refreshing...</span>
            )}
          </div>
          {invitesError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {invitesError}
            </div>
          )}
          {pendingInvites.length === 0 && !invitesLoading && (
            <p className="text-sm text-gray-500">No pending invitations.</p>
          )}
          {pendingInvites.length > 0 && (
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {invite.email}
                    </div>
                    <div className="text-xs text-gray-500 truncate">
                      Expires {new Date(invite.expiresAt || invite.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 uppercase tracking-wide">
                    Pending
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SettingsShell>
  );
};

export default TeamSettings;
