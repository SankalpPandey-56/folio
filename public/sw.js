/**
 * Folio Service Worker
 * Mobile-First Offline Caching & App Shell Performance
 */

const CACHE_NAME = 'folio-v1.0.7';

// App shell assets to pre-cache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/themes.css',
  '/css/style.css',
  '/css/components.css',
  '/js/app.js',
  '/js/firebase-config.js',
  '/js/auth.js',
  '/js/db.js',
  '/js/timer.js',
  '/js/ai.js',
  '/js/ui.js',
  '/assets/icon.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/icon-maskable-192.png',
  '/assets/icon-maskable-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/favicon-32x32.png',
  '/assets/favicon-16x16.png',
  '/assets/favicon.ico'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Precache static assets individually so a single 404 does not break installation
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Precache asset skipped: ${url}`, err);
          })
        )
      );
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`[SW] Deleting stale cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER cache private AI API endpoints or Firebase auth/firestore endpoints
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com')
  ) {
    return; // Pass through to network directly
  }

  // 2. Non-GET requests should always use network
  if (event.request.method !== 'GET') {
    return;
  }

  // 3. Navigation requests: Network-first, fall back to cached /index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/index.html') || caches.match('/');
      })
    );
    return;
  }

  // 4. Static assets: Stale-While-Revalidate strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((err) => {
        // Offline and not in cache
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
