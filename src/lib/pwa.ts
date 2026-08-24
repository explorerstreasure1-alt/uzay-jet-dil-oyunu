import { useCallback, useEffect, useMemo, useState } from 'react';

const IOS_RE = /iphone|ipad|ipod/i;

export interface PwaState {
  canInstall: boolean;
  isInstalled: boolean;
  isIos: boolean;
  isStandalone: boolean;
  install: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

function standalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Service worker failure should never block gameplay.
    });
  });
}

export function usePwaInstall(): PwaState {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => typeof window !== 'undefined' ? standalone() : false);
  const isIos = useMemo(() => typeof navigator !== 'undefined' && IOS_RE.test(navigator.userAgent), []);

  useEffect(() => {
    const beforeInstall = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const installed = () => {
      setPromptEvent(null);
      setIsStandalone(true);
    };
    const media = window.matchMedia('(display-mode: standalone)');
    const modeChanged = () => setIsStandalone(standalone());

    window.addEventListener('beforeinstallprompt', beforeInstall);
    window.addEventListener('appinstalled', installed);
    media.addEventListener?.('change', modeChanged);
    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstall);
      window.removeEventListener('appinstalled', installed);
      media.removeEventListener?.('change', modeChanged);
    };
  }, []);

  const install = useCallback(async () => {
    if (!promptEvent) return 'unavailable' as const;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    return choice.outcome;
  }, [promptEvent]);

  return {
    canInstall: Boolean(promptEvent),
    isInstalled: isStandalone,
    isStandalone,
    isIos,
    install,
  };
}
