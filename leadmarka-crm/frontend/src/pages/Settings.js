import React, { useEffect, useState, useCallback } from 'react';
import { User, Building2, Clock, CheckCircle, Loader2, Mail, Globe, Smartphone, Download, Users, Plus, Trash2, CreditCard, Phone, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LegalFooter from '../components/LegalFooter';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { workspaceAPI, billingAPI } from '../services/api';

const SUPPORT_EMAIL = 'support@leadmarka.co.zw';

const TIMEZONES = [
  { value: 'Africa/Harare', label: 'Harare (Zimbabwe)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (South Africa)' },
  { value: 'Africa/Lagos', label: 'Lagos (Nigeria)' },
  { value: 'Europe/London', label: 'London (UK)' },
  { value: 'America/New_York', label: 'New York (EST)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST)' },
  { value: 'Asia/Dubai', label: 'Dubai (UAE)' },
  { value: 'Asia/Singapore', label: 'Singapore' },
  { value: 'Australia/Sydney', label: 'Sydney (Australia)' },
];

const Settings = () => {
  const { user, updateUser, updateWorkspaceSettings, logout } = useAuth();
  const { canInstall, promptInstall, isStandalone, isIOS } = useInstallPrompt();
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    businessName: user?.businessName || '',
    timezone: user?.timezone || 'Africa/Harare',
    reminderEnabled: user?.reminderEnabled ?? true,
    reminderLeadMinutes: user?.reminderLeadMinutes ?? 5,
    dailySummaryEnabled: user?.dailySummaryEnabled ?? true,
    dailySummaryTime: user?.dailySummaryTime || '08:00',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [installing, setInstalling] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [pendingInvites, setPendingInvites] = useState([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [invitesError, setInvitesError] = useState('');
  const [workspaceName, setWorkspaceName] = useState(user?.workspaceCompanyName || '');
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceSuccess, setWorkspaceSuccess] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');

  // Subscription state
  const [sub, setSub] = useState(user?.subscription || null);
  const [subLoading, setSubLoading] = useState(false);
  const [subError, setSubError] = useState('');
  const [payPhone, setPayPhone] = useState('');
  const [paying, setPaying] = useState(false);
  const [payRef, setPayRef] = useState(null);
  const [payMessage, setPayMessage] = useState('');
  const [paySuccess, setPaySuccess] = useState(false);

  const teamInboxEnabled = Boolean(user?.teamInboxEnabled);
  const isOwner = user?.role === 'owner';
  const displayCompanyName = user?.workspaceCompanyName || user?.businessName;

  // Load subscription status
  const loadSubscription = useCallback(async () => {
    setSubLoading(true);
    setSubError('');
    try {
      const { data } = await billingAPI.getMe();
      setSub(data);
      if (data?.payerPhone && !payPhone) setPayPhone(data.payerPhone);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to load subscription';
      setSubError(typeof msg === 'string' ? msg : 'Failed to load subscription');
    } finally {
      setSubLoading(false);
    }
  }, [payPhone]);

  useEffect(() => { loadSubscription(); }, [loadSubscription]);

  // Poll payment status when a payment is in progress
  useEffect(() => {
    if (!payRef || paySuccess) return;
    let active = true;
    const poll = async () => {
      try {
        const { data } = await billingAPI.getTransaction(payRef);
        if (!active) return;
        const paidStatuses = ['paid', 'awaiting delivery', 'delivered'];
        if (paidStatuses.includes((data.status || '').toLowerCase())) {
          setPaySuccess(true);
          setPayMessage('Payment successful! Your subscription is now active.');
          setPayRef(null);
          loadSubscription();
        } else if (['cancelled', 'refunded', 'error'].includes((data.status || '').toLowerCase())) {
          setPayMessage(`Payment ${data.status.toLowerCase()}. Please try again.`);
          setPayRef(null);
        }
      } catch (err) {
        // ignore poll errors
      }
    };
    const interval = setInterval(poll, 4000);
    poll();
    return () => { active = false; clearInterval(interval); };
  }, [payRef, paySuccess, loadSubscription]);

  const handlePay = async () => {
    if (!payPhone.trim()) return;
    setPaying(true);
    setPayMessage('');
    setPaySuccess(false);
    setSubError('');
    try {
      const { data } = await billingAPI.startEcocash({ phone: payPhone.trim() });
      setPayRef(data.reference);
      setPayMessage(data.instructions || 'Check your phone to confirm the payment.');
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Payment failed';
      setSubError(typeof msg === 'string' ? msg : 'Payment failed');
    } finally {
      setPaying(false);
    }
  };

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

  useEffect(() => {
    setWorkspaceName(user?.workspaceCompanyName || '');
  }, [user?.workspaceCompanyName]);

  const handleInstall = async () => {
    if (!canInstall) return;
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const rawTime = formData.dailySummaryTime || '08:00';
      const [h, m] = rawTime.trim().split(':');
      const dailySummaryTime = `${String(Number(h) || 0).padStart(2, '0')}:${String(Number(m) || 0).padStart(2, '0')}`;

      const fullName = formData.fullName?.trim();
      const payload = {
        businessName: formData.businessName?.trim() ?? '',
        timezone: formData.timezone || 'Africa/Harare',
        reminderEnabled: formData.reminderEnabled,
        reminderLeadMinutes: formData.reminderLeadMinutes,
        dailySummaryEnabled: formData.dailySummaryEnabled,
        dailySummaryTime,
      };
      if (fullName !== undefined && fullName !== '') payload.fullName = fullName;

      await updateUser(payload);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update settings';
      setError(typeof msg === 'string' ? msg : 'Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

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

  const handleWorkspaceSave = async (e) => {
    e.preventDefault();
    const trimmed = workspaceName.trim();
    if (!trimmed) {
      setWorkspaceError('Workspace name cannot be empty');
      return;
    }
    setWorkspaceSaving(true);
    setWorkspaceError('');
    setWorkspaceSuccess(false);
    try {
      await updateWorkspaceSettings({ workspaceCompanyName: trimmed });
      setWorkspaceSuccess(true);
      setTimeout(() => setWorkspaceSuccess(false), 3000);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update workspace name';
      setWorkspaceError(typeof msg === 'string' ? msg : 'Failed to update workspace name');
    } finally {
      setWorkspaceSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Profile Info */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{user?.fullName}</h2>
            <p className="text-sm text-gray-600">{user?.email}</p>
            {displayCompanyName && (
              <p className="text-sm text-gray-500">{displayCompanyName}</p>
            )}
          </div>
        </div>
      </div>

      {/* Subscription */}
      {isOwner && (
        <div className={`rounded-lg p-4 border space-y-3 ${
          sub?.status === 'read_only'
            ? 'bg-red-50 border-red-200'
            : sub?.status === 'grace'
              ? 'bg-yellow-50 border-yellow-200'
              : 'bg-white border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-400" />
              {sub?.plan || 'LeadMarka Pro'}
            </h3>
            {subLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>

          {sub?.paynowMode === 'test' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-yellow-800 text-sm flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-medium">Paynow sandbox (test mode)</div>
                <div className="text-xs text-yellow-800/90">
                  For EcoCash test payments use one of:
                  {' '}
                  <span className="font-mono">0771111111</span> (success),
                  {' '}
                  <span className="font-mono">0772222222</span> (delayed success),
                  {' '}
                  <span className="font-mono">0773333333</span> (cancelled),
                  {' '}
                  <span className="font-mono">0774444444</span> (insufficient balance).
                </div>
              </div>
            </div>
          )}

          {subError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {subError}
            </div>
          )}

          {paySuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-center gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              {payMessage}
            </div>
          )}

          {/* Status display */}
          {sub && !subLoading && (
            <div className="text-sm text-gray-700 space-y-1">
              {sub.status === 'trialing' && (
                <>
                  <p className="font-medium text-primary-700">
                    Free trial — Day {Math.max(1, 8 - (sub.trialDaysLeft || 0))} of 7
                  </p>
                  <p className="text-gray-500 text-xs">
                    Your follow-ups are working. Pro users close 2x more deals.
                  </p>
                </>
              )}
              {sub.status === 'grace' && (
                <p className="font-medium text-yellow-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Trial ended — grace period (1 day remaining)
                </p>
              )}
              {sub.status === 'read_only' && (
                <p className="font-medium text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Subscription expired — your account is read-only
                </p>
              )}
              {sub.status === 'active' && (
                <>
                  <p className="font-medium text-green-700 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    Active
                  </p>
                  {sub.currentPeriodEnd && (
                    <p className="text-gray-500 text-xs">
                      Renews: {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                    </p>
                  )}
                  {sub.compedUntil && (
                    <p className="text-gray-500 text-xs">
                      Complimentary access until {new Date(sub.compedUntil).toLocaleDateString()}
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* Payment form — show for non-comped workspaces */}
          {sub && !sub.compedUntil && sub.status !== 'no_subscription' && (
            <div className="space-y-2 pt-1">
              <label className="block text-sm font-medium text-gray-700">
                EcoCash number
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={payPhone}
                    onChange={(e) => setPayPhone(e.target.value)}
                    placeholder="07XX XXX XXX"
                    className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handlePay}
                  disabled={paying || !payPhone.trim() || !!payRef}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 whitespace-nowrap"
                >
                  {paying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : sub.status === 'active' ? (
                    `Pay $${sub.amount || 15} to extend`
                  ) : (
                    `Pay $${sub.amount || 15}/month to continue`
                  )}
                </button>
              </div>

              {/* Payment in progress */}
              {payRef && !paySuccess && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-blue-700 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span>{payMessage || 'Waiting for EcoCash confirmation...'}</span>
                </div>
              )}

              {/* Payment failed message */}
              {!payRef && payMessage && !paySuccess && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
                  {payMessage}
                </div>
              )}

              <p className="text-xs text-gray-500">
                ${sub.amount || 15}/month per business. Unlimited leads, follow-ups, and team access.
              </p>
            </div>
          )}
        </div>
      )}

      {teamInboxEnabled && (
        <>
          <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              Team
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
                    onChange={(e) => setInviteEmail(e.target.value)}
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
                        Expires {new Date(invite.expiresAt).toLocaleDateString()}
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
        </>
      )}

      {teamInboxEnabled && (
        <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-gray-400" />
            Workspace
          </h3>

          {workspaceSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm">
              Workspace name saved
            </div>
          )}

          {workspaceError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {workspaceError}
            </div>
          )}

          {isOwner ? (
            <form onSubmit={handleWorkspaceSave} className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Company / Workspace name
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                  placeholder="Workspace name"
                  maxLength={120}
                />
              </div>
              <button
                type="submit"
                disabled={workspaceSaving}
                className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
              >
                {workspaceSaving ? 'Saving...' : 'Save Workspace Name'}
              </button>
            </form>
          ) : (
            <div className="text-sm text-gray-600">
              {user?.workspaceCompanyName || 'Workspace name not set yet'}
            </div>
          )}
        </div>
      )}

      {/* Settings Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            Settings saved successfully
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <User className="w-5 h-5 text-gray-400" />
            Personal Info
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={formData.businessName}
                onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                placeholder="Your business name"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Globe className="w-5 h-5 text-gray-400" />
            Regional Settings
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Timezone
            </label>
            <div className="relative">
              <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white appearance-none"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Used for follow-up reminders
            </p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
          <h3 className="font-medium text-gray-900 flex items-center gap-2">
            <Mail className="w-5 h-5 text-gray-400" />
            Reminders
          </h3>

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-700">Enable email reminders</span>
            <input
              type="checkbox"
              checked={formData.reminderEnabled}
              onChange={(e) => setFormData({ ...formData, reminderEnabled: e.target.checked })}
              className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="reminder-lead-minutes">
              Lead time (minutes before)
            </label>
            <input
              id="reminder-lead-minutes"
              type="number"
              min={0}
              max={1440}
              value={formData.reminderLeadMinutes}
              onChange={(e) => {
                const nextValue = Number(e.target.value);
                const safeValue = Number.isFinite(nextValue)
                  ? Math.max(0, Math.min(1440, Math.round(nextValue)))
                  : 0;
                setFormData({
                  ...formData,
                  reminderLeadMinutes: safeValue,
                });
              }}
              disabled={!formData.reminderEnabled}
              className="w-full min-h-[48px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-gray-50 disabled:text-gray-500 text-base touch-manipulation"
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: 10 sends the reminder 10 minutes before the follow-up time.
            </p>
          </div>

          <div className="pt-2 border-t border-gray-100" />

          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-gray-700">Send daily summary email</span>
            <input
              type="checkbox"
              checked={formData.dailySummaryEnabled}
              onChange={(e) => setFormData({ ...formData, dailySummaryEnabled: e.target.checked })}
              className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="daily-summary-time">
              Daily summary time
            </label>
            <input
              id="daily-summary-time"
              type="time"
              value={formData.dailySummaryTime}
              onChange={(e) => setFormData({ ...formData, dailySummaryTime: e.target.value })}
              disabled={!formData.dailySummaryEnabled}
              className="w-full min-h-[48px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-gray-50 disabled:text-gray-500 text-base touch-manipulation bg-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Sent once per day in your selected timezone.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-primary-700 active:bg-primary-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </button>
      </form>

      {/* About Section */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3">About</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>LeadMarka</strong> - WhatsApp CRM</p>
          <p>Version: MVP v1.0</p>
          <p>Never forget a WhatsApp lead again.</p>
          <p>
            Support: {' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
        <LegalFooter className="mt-4" />
      </div>

      {/* App Install */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-gray-400" />
          App
        </h3>

        {isStandalone ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            LeadMarka is installed on this device.
          </div>
        ) : canInstall ? (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-black active:bg-black/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {installing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Opening install…
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Install LeadMarka
              </>
            )}
          </button>
        ) : isIOS ? (
          <div className="text-sm text-gray-600 space-y-1">
            <p>To install on iPhone/iPad:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open in Safari</li>
              <li>Tap Share</li>
              <li>Tap “Add to Home Screen”</li>
            </ol>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            To install, use your browser menu and choose “Install app”.
          </p>
        )}
      </div>

      {/* Logout Button */}
      <button
        onClick={logout}
        className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
      >
        Logout
      </button>
    </div>
  );
};

export default Settings;
