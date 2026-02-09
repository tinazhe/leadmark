import React, { useEffect, useState } from 'react';
import { Building2, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SettingsShell from './SettingsShell';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';

const WorkspaceSettings = () => {
  const { user, updateUser, updateWorkspaceSettings } = useAuth();
  const [workspaceName, setWorkspaceName] = useState(user?.workspaceCompanyName || '');
  const [businessName, setBusinessName] = useState(user?.businessName || '');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const isOwner = user?.role === 'owner';

  useEffect(() => {
    setWorkspaceName(user?.workspaceCompanyName || '');
  }, [user?.workspaceCompanyName]);

  useEffect(() => {
    setBusinessName(user?.businessName || '');
  }, [user?.businessName]);

  const baselineWorkspace = user?.workspaceCompanyName || '';
  const baselineBusiness = user?.businessName || '';
  const isDirty =
    (isOwner && workspaceName.trim() !== baselineWorkspace.trim()) ||
    businessName.trim() !== baselineBusiness.trim();

  useUnsavedChanges(isDirty);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    const trimmedWorkspace = workspaceName.trim();
    const trimmedBusiness = businessName.trim();

    if (isOwner && !trimmedWorkspace) {
      setSaving(false);
      setError('Workspace name cannot be empty');
      return;
    }

    try {
      if (isOwner && trimmedWorkspace !== baselineWorkspace.trim()) {
        await updateWorkspaceSettings({ workspaceCompanyName: trimmedWorkspace });
      }
      if (trimmedBusiness !== baselineBusiness.trim()) {
        await updateUser({ businessName: trimmedBusiness });
      }
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update workspace';
      setError(typeof msg === 'string' ? msg : 'Failed to update workspace');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Workspace"
      description="Control workspace identity and business info."
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
            Company / Workspace name
          </label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
              disabled={!isOwner}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="Workspace name"
              maxLength={120}
            />
          </div>
          {!isOwner && (
            <p className="text-xs text-gray-500 mt-1">
              Only owners can change the workspace name.
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Business name (if distinct)
          </label>
          <input
            type="text"
            value={businessName}
            onChange={(event) => setBusinessName(event.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            placeholder="Your business name"
            maxLength={120}
          />
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
            'Save Workspace'
          )}
        </button>
      </form>
    </SettingsShell>
  );
};

export default WorkspaceSettings;
