import React from 'react';
import { User } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import SettingsShell from './SettingsShell';
import SettingsNav from './SettingsNav';

const SettingsHome = () => {
  const { user } = useAuth();
  const displayCompanyName = user?.workspaceCompanyName || user?.businessName;

  return (
    <SettingsShell
      title="Settings"
      description="Manage your account, workspace, and billing preferences."
    >
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="w-7 h-7 text-primary-600" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">
              {user?.fullName || 'Your Account'}
            </h3>
            <p className="text-sm text-gray-600 truncate">
              {user?.email || 'Signed in'}
            </p>
            {displayCompanyName && (
              <p className="text-xs text-gray-500 truncate">
                {displayCompanyName}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <SettingsNav variant="list" />
      </div>
    </SettingsShell>
  );
};

export default SettingsHome;
