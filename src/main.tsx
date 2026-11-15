import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    registerSW({immediate: true});
  } else if (import.meta.env.DEV) {
    void (async () => {
      const hadController = Boolean(navigator.serviceWorker.controller);
      const regs = await navigator.serviceWorker.getRegistrations();
      let unregistered = false;
      for (const reg of regs) {
        const ok = await reg.unregister();
        if (ok) unregistered = true;
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => /workbox|precache|vite-pwa/i.test(k))
            .map((k) => caches.delete(k))
        );
      }
      if (
        (hadController || unregistered) &&
        sessionStorage.getItem('cc_dev_sw_cleared') !== '1'
      ) {
        sessionStorage.setItem('cc_dev_sw_cleared', '1');
        window.location.reload();
      }
    })();
  }
}

createRoot(document.getElementById('root')!).render(<App />);
