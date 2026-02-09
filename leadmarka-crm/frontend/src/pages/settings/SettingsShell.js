import React from 'react';
import SettingsNav from './SettingsNav';

const SettingsShell = ({ title, description, children }) => (
  <div className="p-4">
    <div className="lg:flex lg:gap-6">
      <aside className="hidden lg:block lg:w-64">
        <div className="sticky top-20">
          <SettingsNav />
        </div>
      </aside>
      <section className="flex-1 space-y-4">
        {(title || description) && (
          <div>
            {title && (
              <h2 className="text-base font-semibold text-gray-900">
                {title}
              </h2>
            )}
            {description && (
              <p className="text-sm text-gray-500 mt-1">
                {description}
              </p>
            )}
          </div>
        )}
        {children}
      </section>
    </div>
  </div>
);

export default SettingsShell;
