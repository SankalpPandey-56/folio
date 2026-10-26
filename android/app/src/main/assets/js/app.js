/**
 * Folio - Application Entry Point
 * Orchestrates Service Worker, Firebase Auth, Database, Timer, and UI
 */

document.addEventListener('DOMContentLoaded', () => {
  console.info("Initializing Folio Reading Companion...");

  // 1. Initialize Authentication and Database
  FolioAuth.init();
  FolioTimer.init();
  FolioUI.init();

  // 2. Wire up Auth changes to Database sync
  FolioAuth.onAuthStateChanged((user) => {
    FolioDB.attachUser(user);
    // If user has theme preference in DB, apply it
    if (user) {
      const prefs = FolioDB.getPreferences();
      if (prefs && prefs.theme) {
        localStorage.setItem('folio_theme', prefs.theme);
      }
    }
  });

  // 3. Network Online / Offline Detection
  window.addEventListener('online', () => {
    console.info("[Folio] Device is back online.");
    FolioUI.showToast("Connection restored. Synchronizing...", "info");
    const user = FolioAuth.getUser();
    if (user) FolioDB.attachUser(user);
  });

  window.addEventListener('offline', () => {
    console.warn("[Folio] Device went offline.");
    FolioDB.setSyncStatus('offline', 'Offline (changes pending)');
    FolioUI.showToast("You are offline. Changes are saved locally and will sync when reconnected.", "info");
  });

  // 4. Register Progressive Web App (PWA) Service Worker
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => {
        console.info("[Folio PWA] Service Worker registered successfully with scope:", reg.scope);
      })
      .catch((err) => {
        console.warn("[Folio PWA] Service Worker registration failed:", err);
      });
  }

  // 5. Handle PWA Install Prompt
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    if (sessionStorage.getItem('folio_pwa_dismissed') === 'true') {
      return;
    }
    const installBanner = document.getElementById('pwa-install-banner');
    if (installBanner) {
      installBanner.style.display = 'flex';
      const installBtn = document.getElementById('btn-pwa-install');
      if (installBtn) {
        installBtn.addEventListener('click', () => {
          installBanner.style.display = 'none';
          deferredPrompt.prompt();
          deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
              console.info("[Folio PWA] User accepted the install prompt");
            }
            deferredPrompt = null;
          });
        });
      }
      const dismissBtn = document.getElementById('btn-pwa-dismiss');
      if (dismissBtn) {
        dismissBtn.addEventListener('click', () => {
          installBanner.style.display = 'none';
          sessionStorage.setItem('folio_pwa_dismissed', 'true');
        });
      }
    }
  });
});
