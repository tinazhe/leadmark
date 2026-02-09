import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Calendar, Users, Settings, Plus, LogOut, ChevronLeft } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getSettingsTitle } from '../pages/settings/settingsData';

const Layout = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isOnline, setIsOnline] = useState(() =>
    typeof window !== 'undefined' ? window.navigator?.onLine !== false : true
  );
  const logoUrl = `${process.env.PUBLIC_URL}/leadmarka_logo-color.svg`;

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const isSettingsRoute = location.pathname.startsWith('/settings');
  const containerWidth = isSettingsRoute ? 'max-w-5xl' : 'max-w-lg';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getPageTitle = () => {
    if (location.pathname === '/') return 'Today';
    if (location.pathname === '/inbox') return 'Team Inbox';
    if (location.pathname === '/leads') return 'All Leads';
    if (location.pathname === '/leads/new') return 'New Lead';
    if (location.pathname.startsWith('/leads/')) return 'Lead Details';
    if (location.pathname === '/settings') return 'Settings';
    if (location.pathname.startsWith('/settings/')) return getSettingsTitle(location.pathname);
    return 'LeadMarka';
  };

  const showBackButton = !['/', '/leads', '/inbox', '/settings'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className={`${containerWidth} mx-auto px-4 h-14 flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            {showBackButton ? (
              <button
                onClick={() => navigate(-1)}
                className="p-2 -ml-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-gray-600" />
              </button>
            ) : (
              <img
                src={logoUrl}
                alt="LeadMarka logo"
                className="w-6 h-6 flex-shrink-0"
              />
            )}
            <h1 className="text-lg font-semibold text-gray-900">
              {getPageTitle()}
            </h1>
          </div>
          
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 hidden sm:block">
                {user.workspaceCompanyName || user.businessName || user.fullName}
              </span>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-2 rounded-full hover:bg-gray-100 active:bg-gray-200 transition-colors"
              >
                <LogOut className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {!isOnline && (
          <div className="border-t border-amber-200 bg-amber-50">
            <div className="max-w-lg mx-auto px-4 py-2 text-sm text-amber-900">
              You’re offline. Some data may be outdated.
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className={`${containerWidth} mx-auto w-full`}>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className={`${containerWidth} mx-auto flex items-center justify-around h-16`}>
          <Link
            to="/"
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              isActive('/') ? 'text-primary-600' : 'text-gray-500'
            }`}
          >
            <Calendar className="w-6 h-6" />
            <span className="text-xs mt-1">Today</span>
          </Link>
          
          <Link
            to={user?.teamInboxEnabled ? '/inbox' : '/leads'}
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              (user?.teamInboxEnabled ? isActive('/inbox') : isActive('/leads') && !location.pathname.includes('/new'))
                ? 'text-primary-600'
                : 'text-gray-500'
            }`}
          >
            <Users className="w-6 h-6" />
            <span className="text-xs mt-1">
              {user?.teamInboxEnabled ? 'Inbox' : 'Leads'}
            </span>
          </Link>
          
          <Link
            to="/leads/new"
            className="flex flex-col items-center justify-center flex-1 h-full text-gray-500"
          >
            <div className="bg-primary-600 rounded-full p-2 -mt-4 shadow-lg">
              <Plus className="w-6 h-6 text-white" />
            </div>
            <span className="text-xs mt-1">Add</span>
          </Link>
          
          <Link
            to="/settings"
            className={`flex flex-col items-center justify-center flex-1 h-full ${
              isActive('/settings') ? 'text-primary-600' : 'text-gray-500'
            }`}
          >
            <Settings className="w-6 h-6" />
            <span className="text-xs mt-1">Settings</span>
          </Link>
        </div>
      </nav>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Logout?
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to logout?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 active:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-3 px-4 bg-danger-500 text-white rounded-lg font-medium hover:bg-danger-600 active:bg-danger-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
