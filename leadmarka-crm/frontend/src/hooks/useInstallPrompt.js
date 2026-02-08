import { useCallback, useEffect, useMemo, useState } from 'react';

function getIsStandalone() {
  if (typeof window === 'undefined') return false;
  // iOS Safari uses `navigator.standalone`
  // Other browsers support display-mode media query.
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone === true
  );
}

function getIsIOS() {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator?.userAgent || '';
  return /iphone|ipad|ipod/i.test(ua);
}

export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(getIsStandalone);

  const isIOS = useMemo(() => getIsIOS(), []);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const onBeforeInstallPrompt = (e) => {
      // Allows us to trigger the prompt later (e.g. from Settings).
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    const onDisplayModeChange = () => {
      setIsStandalone(getIsStandalone());
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    window.matchMedia?.('(display-mode: standalone)')?.addEventListener('change', onDisplayModeChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.matchMedia?.('(display-mode: standalone)')?.removeEventListener('change', onDisplayModeChange);
    };
  }, []);

  const canInstall = !!deferredPrompt && !isStandalone;

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return { outcome: 'dismissed' };

    deferredPrompt.prompt?.();
    const choice = await deferredPrompt.userChoice?.catch(() => null);
    setDeferredPrompt(null);
    setIsStandalone(getIsStandalone());

    return choice || { outcome: 'dismissed' };
  }, [deferredPrompt]);

  return {
    canInstall,
    promptInstall,
    isStandalone,
    isIOS,
  };
}

