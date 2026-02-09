import React, { useEffect, useState } from 'react';
import { CheckCircle, Clock, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SettingsShell from './SettingsShell';
import useUnsavedChanges from '../../hooks/useUnsavedChanges';

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

const RegionalSettings = () => {
  const { user, updateUser } = useAuth();
  const [timezone, setTimezone] = useState(user?.timezone || 'Africa/Harare');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setTimezone(user?.timezone || 'Africa/Harare');
  }, [user?.timezone]);

  const baseline = user?.timezone || 'Africa/Harare';
  const isDirty = timezone !== baseline;

  useUnsavedChanges(isDirty);

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await updateUser({ timezone });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to update timezone';
      setError(typeof msg === 'string' ? msg : 'Failed to update timezone');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsShell
      title="Regional"
      description="Set the timezone used for follow-ups."
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
            Timezone
          </label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
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
            Used for follow-up reminders.
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
            'Save Regional Settings'
          )}
        </button>
      </form>
    </SettingsShell>
  );
};

export default RegionalSettings;
