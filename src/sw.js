import {
  PRECACHE_NAME,
  RUNTIME_CACHE_NAME,
  PRECACHE_URLS,
  isCacheableRequest,
  staleCacheNames,
} from './services/OfflineCachePolicy.js';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(staleCacheNames(names).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// Cache-first with a background revalidation fetch (stale-while-revalidate), the same
// precedent Workbox's runtime caching uses for app-shell assets — keeps offline navigation
// instant while still picking up new deploys once connectivity returns.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (!isCacheableRequest(request)) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((response) => {
          if (response?.ok) {
            const clone = response.clone();
            caches.open(RUNTIME_CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached ?? networkFetch;
    }),
  );
});
