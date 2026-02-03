import React, { useState } from 'react';
import { User, Building2, Clock, CheckCircle, Loader2, Mail, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import LegalFooter from '../components/LegalFooter';

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
  const { user, updateUser, logout } = useAuth();
  const [formData, setFormData] = useState({
    fullName: user?.fullName || '',
    businessName: user?.businessName || '',
    timezone: user?.timezone || 'Africa/Harare',
    reminderEnabled: user?.reminderEnabled ?? true,
    reminderLeadMinutes: user?.reminderLeadMinutes ?? 5,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      await updateUser({
        fullName: formData.fullName,
        businessName: formData.businessName,
        timezone: formData.timezone,
        reminderEnabled: formData.reminderEnabled,
        reminderLeadMinutes: formData.reminderLeadMinutes,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to update settings');
    } finally {
      setSaving(false);
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
            {user?.businessName && (
              <p className="text-sm text-gray-500">{user?.businessName}</p>
            )}
          </div>
        </div>
      </div>

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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lead time (minutes before)
            </label>
            <input
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
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none disabled:bg-gray-50 disabled:text-gray-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Example: 10 sends the reminder 10 minutes before the follow-up time.
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
