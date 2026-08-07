import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (!window.isSecureContext) return;

    const register = async () => {
      try {
        await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
      } catch (error) {
        console.error('Failed to register service worker', error);
      }
    };

    void register();
  }, []);

  return null;
}
