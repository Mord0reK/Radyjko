/* global self, caches, URL, location, fetch */

const STATIC_CACHE = 'radyjko-vite-static-v2';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(ASSETS_TO_CACHE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE) {
            return caches.delete(cacheName);
          }
          return undefined;
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Cache local icons. Hashed /assets files use browser and Cloudflare caching.
  if (url.pathname.startsWith('/ikony/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, responseToCache)));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // HTML documents are network-only so a deployment cannot be pinned by SW cache.
  if (event.request.mode === 'navigate' || event.request.destination === 'document') {
    event.respondWith(fetch(event.request));
    return;
  }

  // Inne requesty - defaultowo network
  event.respondWith(fetch(event.request));
});
