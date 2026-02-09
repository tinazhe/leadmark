import React, { useEffect, useState } from 'react';
import { CheckCircle, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SettingsShell from './SettingsShell';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';

const NotificationsSettings = () => {
  const { user, updateUser } = useAuth();
  const [formData, setFormData] = useState({
    reminderEnabled: user?.reminderEnabled ?? true,
    reminderLeadMinutes: user?.reminderLeadMinutes ?? 5,
    dailySummaryEnabled: user?.dailySummaryEnabled ?? true,
    dailySummaryTime: user?.dailySummaryTime || '08:00',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setFormData({
      reminderEnabled: user?.reminderEnabled ?? true,
      reminderLeadMinutes: user?.reminderLeadMinutes ?? 5,
      dailySummaryEnabled: user?.dailySummaryEnabled ?? true,
      dailySummaryTime: user?.dailySummaryTime || '08:00',
    });
  }, [
    user?.reminderEnabled,
    user?.reminderLeadMinutes,
    user?.dailySummaryEnabled,
    user?.dailySummaryTime,
  ]);

  const baseline = {
    reminderEnabled: user?.reminderEnabled ?? true,
    reminderLeadMinutes: user?.reminderLeadMinutes ?? 5,
    dailySummaryEnabled: user?.dailySummaryEnabled ?? true,
    dailySummaryTime: user?.dailySummaryTime || '08:00',
  };

  const isDirty =
    formData.reminderEnabled !== baseline.reminderEnabled ||
    formData.reminderLeadMinutes !== baseline.reminderLeadMinutes ||
    formData.dailySummaryEnabled !== baseline.dailySummaryEnabled ||
    formData.dailySummaryTime !== baseline.dailySummaryTime;

  useUnsavedChanges(isDirty);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      const rawTime = formData.dailySummaryTime || '08:00';
      const [h, m] = rawTime.trim().split(':');
      const dailySummaryTime = `${String(Number(h) || 0).padStart(2, '0')}:${String(Number(m) || 0).padStart(2, '0')}`;

      await updateUser({
        reminderEnabled: formData.reminderEnabled,
        reminderLeadMinutes: formData.reminderLeadMinutes,
        dailySummaryEnabled: formData.dailySummaryEnabled,
        dailySummaryTime,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update notifications';
      setError(typeof msg === 'string' ? msg : 'Failed to update notifications');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Notifications"
      description="Control reminder emails and daily summaries."
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
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-gray-900">Email reminders</div>
            <div className="text-xs text-gray-500">Send reminder emails before follow-ups.</div>
          </div>
          <input
            type="checkbox"
            checked={formData.reminderEnabled}
            onChange={(event) => setFormData({
              ...formData,
              reminderEnabled: event.target.checked,
            })}
            className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        </div>

        {formData.reminderEnabled && (
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
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                const safeValue = Number.isFinite(nextValue)
                  ? Math.max(0, Math.min(1440, Math.round(nextValue)))
                  : 0;
                setFormData({
                  ...formData,
                  reminderLeadMinutes: safeValue,
                });
              }}
              className="w-full min-h-[48px] px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: 10 sends the reminder 10 minutes before the follow-up time.
            </p>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100" />

        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-gray-900">Daily summary</div>
            <div className="text-xs text-gray-500">Get a daily recap of your pipeline.</div>
          </div>
          <input
            type="checkbox"
            checked={formData.dailySummaryEnabled}
            onChange={(event) => setFormData({
              ...formData,
              dailySummaryEnabled: event.target.checked,
            })}
            className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        </div>

        {formData.dailySummaryEnabled && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="daily-summary-time">
              Daily summary time
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="daily-summary-time"
                type="time"
                value={formData.dailySummaryTime}
                onChange={(event) => setFormData({
                  ...formData,
                  dailySummaryTime: event.target.value,
                })}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Sent once per day in your selected timezone.
            </p>
          </div>
        )}

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
            'Save Notifications'
          )}
        </button>
      </form>
    </SettingsShell>
  );
};

export default NotificationsSettings;
