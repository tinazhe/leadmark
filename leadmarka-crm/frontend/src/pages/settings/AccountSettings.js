import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SettingsShell from './SettingsShell';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';

const AccountSettings = () => {
  const { user, updateUser, logout } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFullName(user?.fullName || '');
  }, [user?.fullName]);

  const baselineName = user?.fullName || '';
  const isDirty = fullName.trim() !== baselineName.trim();
  useUnsavedChanges(isDirty);

  const handleSave = async (event) => {
    event.preventDefault();
    const trimmed = fullName.trim();
    if (!trimmed) {
      setError('Full name cannot be empty');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateUser({ fullName: trimmed });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update profile';
      setError(typeof msg === 'string' ? msg : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Account"
      description="Update your personal details and login info."
    >
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-700 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Saved
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-lg p-4 border border-gray-200 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Email changes are managed by support for now.
          </p>
        </div>

        <button
          type="submit"
          disabled={saving || !isDirty}
          className="w-full bg-primary-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Account'
          )}
        </button>
      </form>

      <button
        type="button"
        onClick={logout}
        className="w-full bg-white border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 active:bg-gray-100 transition-colors"
      >
        Logout
      </button>
    </SettingsShell>
  );
};

export default AccountSettings;
