/**
 * Nocturne PWA — Service Worker
 * Caches core assets for offline use.
 */

const CACHE = 'nocturne-v2';
const BASE = self.location.pathname.replace(/\/[^/]*$/, '');
const ASSETS = [
  BASE + '/',
  BASE + '/index.html',
  BASE + '/styles.css',
  BASE + '/app.js',
  BASE + '/data.js',
  BASE + '/api.js',
  BASE + '/i18n.js',
  BASE + '/manifest.json',
  BASE + '/icon-192.svg',
  BASE + '/icon-512.svg',
];

// Install: pre-cache all core assets
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for API
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // API requests — network first, no cache
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({ success: false, error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    );
    return;
  }

  // Static assets — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const fetched = fetch(e.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, clone));
        }
        return response;
      });
      return cached || fetched;
    })
  );
});
