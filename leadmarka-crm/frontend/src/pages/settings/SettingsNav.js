import React from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { SETTINGS_CATEGORIES } from './settingsData';

const SettingsNav = ({ variant = 'sidebar' }) => {
  const isList = variant === 'list';

  return (
    <div className={isList ? 'bg-white border border-gray-200 rounded-lg divide-y' : 'space-y-1'}>
      {SETTINGS_CATEGORIES.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.key}
            to={item.path}
            className={({ isActive }) => (
              isList
                ? `flex items-center justify-between px-4 py-3 hover:bg-gray-50 ${isActive ? 'bg-primary-50' : ''}`
                : `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
            )}
          >
            <div className={`flex items-center gap-3 ${isList ? '' : 'min-w-0'}`}>
              <div className={isList ? 'w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center' : ''}>
                <Icon className={isList ? 'w-4 h-4 text-primary-600' : 'w-4 h-4'} />
              </div>
              <div className={isList ? 'min-w-0' : ''}>
                <div className="text-sm font-medium text-gray-900">
                  {item.label}
                </div>
                {isList && (
                  <div className="text-xs text-gray-500">
                    {item.description}
                  </div>
                )}
              </div>
            </div>
            {isList && (
              <ChevronRight className="w-4 h-4 text-gray-400" />
            )}
          </NavLink>
        );
      })}
    </div>
  );
};

export default SettingsNav;
