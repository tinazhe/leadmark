import React, { useMemo, useState } from 'react';
import { CheckCircle, Mail, Link2, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SettingsShell from './SettingsShell';

const normalizeEmailEntry = (entry) => {
  if (!entry) return null;
  if (typeof entry === 'string') return { email: entry };
  const email = entry.email || entry.address || entry.value;
  if (!email) return null;
  return {
    email,
    expiresAt: entry.expiresAt || entry.expires_at || null,
  };
};

const IntegrationsSettings = () => {
  const { user } = useAuth();
  const [actionMessage, setActionMessage] = useState('');
  const [removedEmails, setRemovedEmails] = useState([]);

  const connectedEmails = useMemo(() => {
    const list =
      (Array.isArray(user?.connectedEmails) && user.connectedEmails) ||
      (Array.isArray(user?.verifiedEmails) && user.verifiedEmails) ||
      [];
    return list
      .map(normalizeEmailEntry)
      .filter(Boolean)
      .map((entry) => entry.email);
  }, [user]);

  const pendingRaw = useMemo(() => {
    const list =
      (Array.isArray(user?.pendingEmailVerifications) && user.pendingEmailVerifications) ||
      (Array.isArray(user?.pendingEmails) && user.pendingEmails) ||
      [];
    return list.map(normalizeEmailEntry).filter(Boolean);
  }, [user]);

  const pendingUnique = useMemo(() => {
    const map = new Map();
    pendingRaw.forEach((entry) => {
      const key = entry.email.toLowerCase();
      if (!map.has(key)) {
        map.set(key, { ...entry, count: 1 });
      } else {
        const current = map.get(key);
        map.set(key, { ...current, count: current.count + 1 });
      }
    });
    return Array.from(map.values())
      .filter((entry) => !removedEmails.includes(entry.email.toLowerCase()));
  }, [pendingRaw, removedEmails]);

  const duplicateCount = Math.max(0, pendingRaw.length - pendingUnique.length);

  const handleResend = (email) => {
    setActionMessage(`Resend requested for ${email}.`);
    setTimeout(() => setActionMessage(''), 2500);
  };

  const handleRemove = (email) => {
    setRemovedEmails((prev) => [...prev, email.toLowerCase()]);
    setActionMessage(`${email} removed from pending list.`);
    setTimeout(() => setActionMessage(''), 2500);
  };

  return (
    <SettingsShell
      title="Integrations"
      description="Connect messaging tools and verify email domains."
    >
      {actionMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {actionMessage}
        </div>
      )}

      <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-gray-400" />
            <h3 className="font-medium text-gray-900">WhatsApp</h3>
          </div>
          <span className="text-xs text-gray-500">Coming soon</span>
        </div>
        <p className="text-sm text-gray-600">
          Connect WhatsApp to auto-capture leads and sync messages.
        </p>
        <button
          type="button"
          disabled
          className="w-full bg-gray-900 text-white py-2.5 px-4 rounded-lg font-medium opacity-50"
        >
          Connect WhatsApp
        </button>
      </div>

      <div className="bg-white rounded-lg p-4 border border-gray-200 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-gray-400" />
          <h3 className="font-medium text-gray-900">Email verification</h3>
        </div>
        <p className="text-sm text-gray-600">
          Verify email domains to improve deliverability.
        </p>

        <div className="rounded-lg border border-gray-200 p-3">
          <div className="text-xs text-gray-500 uppercase tracking-wide">Connected emails ({connectedEmails.length})</div>
          {connectedEmails.length === 0 ? (
            <p className="text-sm text-gray-500 mt-2">No connected emails yet.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {connectedEmails.map((email) => (
                <div key={email} className="text-sm text-gray-700">
                  {email}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 p-3">
          {pendingUnique.length === 0 ? (
            <>
              <div className="text-xs text-gray-500 uppercase tracking-wide">
                Pending verifications (0)
              </div>
              <p className="text-sm text-gray-500 mt-2">No pending verifications.</p>
            </>
          ) : (
            <details>
              <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                Pending verifications ({pendingUnique.length})
              </summary>
              <div className="mt-3 space-y-3">
                {pendingUnique.map((entry) => (
                  <div key={entry.email} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{entry.email}</div>
                        <div className="text-xs text-gray-500">
                          Verification email sent. Check inbox.
                        </div>
                        {entry.expiresAt && (
                          <div className="text-xs text-gray-400">
                            Expires {new Date(entry.expiresAt).toLocaleDateString()}
                          </div>
                        )}
                        {entry.count > 1 && (
                          <div className="text-xs text-gray-400">{entry.count} duplicate entries grouped</div>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Pending</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleResend(entry.email)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Resend verification
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemove(entry.email)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
          {duplicateCount > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {duplicateCount} duplicate entries hidden for clarity.
            </p>
          )}
        </div>
      </div>
    </SettingsShell>
  );
};

export default IntegrationsSettings;
