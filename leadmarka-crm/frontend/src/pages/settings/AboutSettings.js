import React, { useState } from 'react';
import { CheckCircle, Download, Loader2, Smartphone } from 'lucide-react';
import SettingsShell from './SettingsShell';
import LegalFooter from '../../components/LegalFooter';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

const SUPPORT_EMAIL = 'support@leadmarka.co.zw';

const AboutSettings = () => {
  const { canInstall, promptInstall, isStandalone, isIOS } = useInstallPrompt();
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    if (!canInstall) return;
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <SettingsShell
      title="About & Legal"
      description="App details, support, and legal policies."
    >
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3">About</h3>
        <div className="space-y-2 text-sm text-gray-600">
          <p><strong>LeadMarka</strong> - WhatsApp CRM</p>
          <p>Version: MVP v1.0</p>
          <p>Never forget a WhatsApp lead again.</p>
          <p>
            Support:{' '}
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

      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-gray-400" />
          App
        </h3>

        {isStandalone ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            LeadMarka is installed on this device.
          </div>
        ) : canInstall ? (
          <button
            type="button"
            onClick={handleInstall}
            disabled={installing}
            className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg font-medium hover:bg-black active:bg-black/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {installing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Opening install…
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Install LeadMarka
              </>
            )}
          </button>
        ) : isIOS ? (
          <div className="text-sm text-gray-600 space-y-1">
            <p>To install on iPhone/iPad:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Open in Safari</li>
              <li>Tap Share</li>
              <li>Tap “Add to Home Screen”</li>
            </ol>
          </div>
        ) : (
          <p className="text-sm text-gray-600">
            To install, use your browser menu and choose “Install app”.
          </p>
        )}
      </div>
    </SettingsShell>
  );
};

export default AboutSettings;
